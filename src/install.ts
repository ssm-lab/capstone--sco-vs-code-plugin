import * as path from 'path';
import * as childProcess from 'child_process';
import { access, unlink, writeFile } from 'fs/promises';

const PACKAGE_NAME = 'ecooptimizer';
const PYPI_INDEX = 'https://pypi.org/simple';

interface InstallConfig {
  pythonPath: string;
  version: string;
  targetDir: string;
}

async function ensurePythonEnvironment(config: InstallConfig): Promise<string> {
  const venvPath = path.join(config.targetDir, '.venv');
  const isWindows = process.platform === 'win32';
  const pythonExecutable = path.join(
    venvPath,
    isWindows ? 'Scripts' : 'bin',
    isWindows ? 'python.exe' : 'python',
  );

  try {
    // 1. First verify Python is available
    await new Promise<void>((resolve, reject) => {
      const pythonCheck = childProcess.spawn(config.pythonPath, ['--version']);
      pythonCheck.stderr?.on('data', (chunk) => console.error(chunk));
      pythonCheck.stdout?.on('data', (chunk) => console.log(chunk));
      pythonCheck.on('close', (code) => {
        code === 0
          ? resolve()
          : reject(new Error(`Python check failed (code ${code})`));
      });
      pythonCheck.on('error', (err) => {
        console.error(err);
        reject(err);
      });
    });

    // 2. Check if venv already exists
    let venvExists = false;
    try {
      await access(venvPath);
      venvExists = true;
      console.log('Virtual environment already exists');
    } catch {
      console.log('Creating virtual environment...');
    }

    if (!venvExists) {
      const tempFile = path.join(config.targetDir, 'create_venv_temp.py');
      try {
        const scriptContent = `
import sys
import venv
import os

try:
    venv.create("${venvPath.replace(/\\/g, '\\\\')}", 
               clear=True,
               with_pip=True)
    print("VENV_CREATION_SUCCESS")
except Exception as e:
    print(f"VENV_CREATION_ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;
        await writeFile(tempFile, scriptContent);

        const creationSuccess = await new Promise<boolean>((resolve, reject) => {
          const proc = childProcess.spawn(config.pythonPath, [tempFile], {
            stdio: 'pipe',
          });

          let output = '';
          let errorOutput = '';

          proc.stdout.on('data', (data) => (output += data.toString()));
          proc.stderr.on('data', (data) => (errorOutput += data.toString()));

          proc.on('close', (code) => {
            if (code === 0 && output.includes('VENV_CREATION_SUCCESS')) {
              resolve(true);
            } else {
              const errorMatch = errorOutput.match(/VENV_CREATION_ERROR: (.+)/);
              const errorMessage =
                errorMatch?.[1] || `Process exited with code ${code}`;
              console.error('Virtual environment creation failed:', errorMessage);
              reject(new Error(errorMessage)); // Reject with the error message
            }
          });

          proc.on('error', (err) => {
            console.error('Process error:', err);
            reject(err); // Reject with the process error
          });
        });

        if (!creationSuccess) {
          try {
            await access(pythonExecutable);
            console.warn('Using partially created virtual environment');
          } catch (accessError) {
            console.error(
              'Partial virtual environment creation failed:',
              accessError,
            );
            throw new Error('Virtual environment creation completely failed');
          }
        }
      } finally {
        await unlink(tempFile).catch(() => {});
      }
    }

    // 3. Verify the venv Python exists
    await access(pythonExecutable);
    return pythonExecutable;
  } catch (error: any) {
    console.error('Error in ensurePythonEnvironment:', error.message);
    throw error;
  }
}

async function verifyPyPackage(
  pythonPath: string,
  config: InstallConfig,
): Promise<boolean> {
  console.log('Verifying python package version...');
  const installedVersion = childProcess
    .execSync(
      `"${pythonPath}" -c "import importlib.metadata; print(importlib.metadata.version('${PACKAGE_NAME}'))"`,
    )
    .toString()
    .trim();

  if (installedVersion !== config.version) {
    throw new Error(
      `Version mismatch: Expected ${config.version}, got ${installedVersion}`,
    );
  }

  console.log('Version match.');

  return true;
}

async function installFromPyPI(config: InstallConfig): Promise<void> {
  let pythonPath: string;
  try {
    pythonPath = await ensurePythonEnvironment(config);
    console.log('Python environment is ready at:', pythonPath);
  } catch (error: any) {
    console.error('Failed to set up Python environment:', error.message);
    return;
  }
  const pipPath = pythonPath.replace('python', 'pip');

  if (await verifyPyPackage(pythonPath, config)) {
    console.log('Package already installed.');
    return;
  }

  console.log('Installing setup tools...');
  try {
    childProcess.execSync(`"${pipPath}" install --upgrade "setuptools>=45.0.0"`, {
      stdio: 'inherit',
    });
  } catch (error) {
    console.warn('Could not update setuptools:', error);
  }

  console.log('Installing ecooptimizer...');
  try {
    childProcess.execSync(
      `"${pipPath}" install --index-url ${PYPI_INDEX} "${PACKAGE_NAME}==${config.version}"`,
      { stdio: 'inherit' },
    );

    verifyPyPackage(pythonPath, config);
    console.log('✅ Installation completed successfully');
  } catch (error) {
    console.error('❌ Installation failed:', error);
    throw error;
  }
}

async function findPythonPath(): Promise<string> {
  // 1. Check explicitly set environment variable
  if (process.env.PYTHON_PATH && (await validatePython(process.env.PYTHON_PATH))) {
    return process.env.PYTHON_PATH;
  }

  // 2. Common Python executable names (ordered by preference)
  const candidates = ['python', 'python3.10', 'python3', 'py'];

  // 3. Platform-specific locations
  if (process.platform === 'win32') {
    candidates.push(
      path.join(
        process.env.LOCALAPPDATA || '',
        'Programs',
        'Python',
        'Python310',
        'python.exe',
      ),
      path.join(process.env.ProgramFiles || '', 'Python310', 'python.exe'),
    );
  }

  if (process.platform === 'darwin') {
    candidates.push('/usr/local/bin/python3'); // Homebrew default
  }

  // Check common Python management tools
  if (process.env.CONDA_PREFIX) {
    candidates.push(path.join(process.env.CONDA_PREFIX, 'bin', 'python'));
  }

  if (process.env.VIRTUAL_ENV) {
    candidates.push(path.join(process.env.VIRTUAL_ENV, 'bin', 'python'));
  }

  // 4. Test each candidate
  for (const candidate of candidates) {
    try {
      if (await validatePython(candidate)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error('No valid Python installation found');
}

async function validatePython(pythonPath: string): Promise<boolean> {
  try {
    // Check Python exists and has required version (3.9+)
    const versionOutput = childProcess
      .execSync(`"${pythonPath}" --version`)
      .toString()
      .trim();

    // Parse version (e.g., "Python 3.10.6")
    const versionMatch = versionOutput.match(/Python (\d+)\.(\d+)/);
    if (!versionMatch) return false;

    const major = parseInt(versionMatch[1]);
    const minor = parseInt(versionMatch[2]);

    console.log('Python version:', major, minor);

    return major === 3 && minor >= 9; // Require Python 3.9+
  } catch {
    return false;
  }
}

// Updated main execution block
if (require.main === module) {
  (async (): Promise<void> => {
    try {
      const config: InstallConfig = {
        pythonPath: await findPythonPath(),
        version: require('../package.json').version,
        targetDir: process.cwd(),
      };

      console.log(`Using Python at: ${config.pythonPath}`);
      await installFromPyPI(config);
    } catch (error) {
      console.error('Fatal error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  })();
}
