import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const historyFile = path.join(
  os.homedir(),
  ".vscode-window-history",
  "history.json"
);

let quickPick: vscode.QuickPick<vscode.QuickPickItem> | null = null;
let quickPickItemList: vscode.QuickPickItem[] = [];
let quickPickVisible = false;
let quickPickIndex = 0;

interface Window {
  pid: number;
  workspacePath: string;
}

export function activate(context: vscode.ExtensionContext) {
  registerWindow();

  const disposable = vscode.commands.registerCommand(
    "vscode-window-history.goToPreviousWindow",
    () => {
      try {
        const windowList: Window[] = loadWindowList().filter(
          (w) => w.pid !== process.pid
        );
        if (windowList.length === 0) {
          vscode.window.showInformationMessage("The window history is empty.");
          return;
        }
        const itemList: vscode.QuickPickItem[] = windowList.map((w, index) => {
          const prefix = index < 9 ? `${index + 1}) ` : "";
          return {
            label: prefix + path.basename(w.workspacePath),
            description: w.workspacePath,
          };
        });
        quickPickItemList = itemList;
        if (quickPickVisible && quickPickItemList.length > 0) {
          quickPickIndex = (quickPickIndex + 1) % quickPickItemList.length;
        } else {
          quickPickIndex = 0;
        }
        showQuickPick();
      } catch (err) {
        console.error("Command 'Go to Previous Window' failed", err);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  unregisterWindow();
}

function showQuickPick() {
  if (!quickPick) {
    quickPick = vscode.window.createQuickPick();
  }

  quickPick.items = quickPickItemList;
  quickPick.activeItems = [quickPickItemList[quickPickIndex]];
  quickPick.placeholder = "Choose window (or press 1-9)...";
  quickPick.ignoreFocusOut = true;
  quickPick.matchOnDescription = true;

  quickPickVisible = true;

  quickPick.onDidAccept(() => {
    const selectedItem = quickPick?.selectedItems[0];
    if (selectedItem) {
      goToWindow(selectedItem);
    }
    closeQuickPick();
  });

  quickPick.onDidHide(() => {
    closeQuickPick();
  });

  quickPick.onDidChangeValue((input) => {
    const match = input.trim().match(/^([1-9])$/);
    if (match) {
      const itemIndex = parseInt(match[1], 10) - 1;
      if (itemIndex < quickPickItemList.length) {
        const selectedItem = quickPickItemList[itemIndex];
        goToWindow(selectedItem);
        closeQuickPick();
      }
    }
  });

  quickPick.show();
}

function closeQuickPick() {
  quickPick?.dispose();
  quickPick = null;
  quickPickVisible = false;
}

function registerWindow() {
  try {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) {
      return;
    }
    const window: Window = {
      workspacePath: folder,
      pid: process.pid,
    };
    const windowList: Window[] = loadWindowList().filter(
      (w) => w.pid !== window.pid && w.workspacePath !== folder
    );
    windowList.unshift(window);
    saveWindowList(windowList);
  } catch (err) {
    console.error("Registering window failed", err);
  }
}

function unregisterWindow() {
  try {
    const windowList: Window[] = loadWindowList().filter(
      (w) => w.pid !== process.pid
    );
    saveWindowList(windowList);
  } catch (err) {
    console.error("Unregistering window failed", err);
  }
}

function goToWindow(item: vscode.QuickPickItem) {
  const windowList = loadWindowList();
  const selectedWindowIndex = windowList.findIndex(
    (w) => w.workspacePath === item.description
  );
  if (selectedWindowIndex === -1) {
    return;
  }
  const selectedWindow = windowList.splice(selectedWindowIndex, 1)[0];
  windowList.unshift(selectedWindow);
  saveWindowList(windowList);
  vscode.commands.executeCommand(
    "vscode.openFolder",
    vscode.Uri.file(selectedWindow.workspacePath),
    false
  );
}

function loadWindowList(): Window[] {
  if (!fs.existsSync(historyFile)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(historyFile, "utf-8"));
}

function saveWindowList(windowList: Window[]) {
  fs.mkdirSync(path.dirname(historyFile), { recursive: true });
  fs.writeFileSync(historyFile, JSON.stringify(windowList, null, 2));
}
