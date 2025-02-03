const vscode = acquireVsCodeApi();

function updateWebView(data) {
  // Hide "No refactoring in progress" message
  document.getElementById('no-data').style.display = 'none';
  document.getElementById('container').style.display = 'block';

  // Update Energy Saved
  document.getElementById(
    'energy'
  ).textContent = `Energy Saved: ${data.energySaved.toExponential(3)} J`;

  // Populate Target File
  const targetFileList = document.getElementById('target-file-list');
  targetFileList.innerHTML = '';
  const targetFile = data.targetFile.refactored.replace(data.tempDir, '');
  const li = document.createElement('li');
  li.textContent = targetFile;
  li.classList.add('clickable');
  li.onclick = () => {
    vscode.postMessage({
      command: 'selectFile',
      original: data.targetFile.original,
      refactored: data.targetFile.refactored
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
    li.textContent = file.refactored.replace(data.tempDir, '');
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
    updateWebView(event.data.data);
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
