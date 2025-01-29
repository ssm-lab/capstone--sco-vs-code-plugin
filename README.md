VS Code Plugin for Source Code Optimizer

1. clone this repo
2. open terminal and write:
    `npm install` (only the first time)
    `npm run compile` | `npm run watch` <- second command will auto compile on save
3. open another vs code window with the ecooptimzer repo
4. start venv in the ecooptimizer repo
5. run "python -m ecoopitmizer.api.main" in terminal to start the developement server manually
6. come back to this repo, go to run and debug (or just click `F5` key)
7. run extension (should open a new vs code window so open the repo u want in this)
8. in the vscode search bar (`ctrl+shift+p`) type ">eco: detect smells" and run it
