const vscode = acquireVsCodeApi();

function updateWebView(data, sep) {
  // Hide "No refactoring in progress" message
  document.getElementById('no-data').style.display = 'none';
  document.getElementById('container').style.display = 'block';

  // Update Energy Saved
  document.getElementById(
    'energy'
  ).textContent = `Energy Saved: ${data.energySaved.toExponential(3)} kg CO2`;

  // Populate Target File
  const targetFile = data.targetFile;
  const targetFileList = document.getElementById('target-file-list');
  targetFileList.innerHTML = '';
  const li = document.createElement('li');

  const relFile = findRelPath(targetFile.refactored, sep);
  if (relFile.length === 0) {
    relFile = targetFile.original;
  }
  li.textContent = relFile;

  li.classList.add('clickable');
  li.onclick = () => {
    vscode.postMessage({
      command: 'selectFile',
      original: targetFile.original,
      refactored: targetFile.refactored
    });
  };
  targetFileList.appendChild(li);

  // Populate Other Modified Files
  const affectedFileList = document.getElementById('affected-file-list');
  affectedFileList.innerHTML = '';
  if (data.affectedFiles.length === 0) {
    document.getElementById('other-files-head').style.display = 'none';
  }
  data.affectedFiles.forEach((file) => {
    const li = document.createElement('li');
    const relFile = findRelPath(file.refactored, sep);

    if (relFile.length === 0) {
      relFile = file.original;
    }

    li.textContent = relFile;
    li.classList.add('clickable');
    li.onclick = () => {
      vscode.postMessage({
        command: 'selectFile',
        original: file.original,
        refactored: file.refactored
      });
    };
    affectedFileList.appendChild(li);
  });

  // Save state in the webview
  vscode.setState(data);
}

// Function to clear the UI (for when refactoring is done)
function clearWebview() {
  document.getElementById('energy').textContent = 'Energy Saved: --';
  document.getElementById('target-file-list').innerHTML = '';
  document.getElementById('affected-file-list').innerHTML = '';

  document.getElementById('no-data').style.display = 'block';
  document.getElementById('container').style.display = 'none';
  vscode.setState(null); // Clear state
}

// Restore state when webview loads
window.addEventListener('DOMContentLoaded', () => {
  const savedState = vscode.getState();
  if (savedState) {
    updateWebView(savedState);
  }
});

// Listen for extension messages
window.addEventListener('message', (event) => {
  if (event.data.command === 'update') {
    updateWebView(event.data.data, event.data.sep);
  } else if (event.data.command === 'clear') {
    clearWebview();
  } else if (event.data.command === 'pause') {
    document.getElementById('no-data').style.display = 'block';
    document.getElementById('container').style.display = 'none';
  }
});

// Button click handlers
document.getElementById('accept-btn').addEventListener('click', () => {
  vscode.postMessage({ command: 'accept' });
  clearWebview();
});

document.getElementById('reject-btn').addEventListener('click', () => {
  vscode.postMessage({ command: 'reject' });
  clearWebview();
});

function findRelPath(filePath, sep) {
  // Split the path using the separator
  const parts = filePath.split(sep);

  // Find the index of the part containing the 'ecooptimizer-' substring
  const index = parts.findIndex((part) => part.includes('ecooptimizer-'));

  // If a matching part is found, return the joined list of items after it
  if (index !== -1) {
    // Slice the array from the next index and join them with the separator
    return parts.slice(index + 1).join(sep);
  }

  // Return an empty string if no match is found
  return '';
}
