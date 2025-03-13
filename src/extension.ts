// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PackageJson, KebapPackageJson, KebapPackage, KebapVersion } from './packageJson';
import { ChildProcess, spawn } from 'child_process';

const IsJustStabilVersions = true;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    console.log('Uzantı aktif edildi.');


    readPackageJson().then((packageJson: KebapPackageJson) => {

        // Sidebar'ı kaydet
        const sidebarProvider = new KebapSidebarView(packageJson.dependencies);
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('kebapSidebarView', sidebarProvider)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('kebapSidebarView.itemClick', (item) => {
                vscode.window.showInformationMessage('Öğe 1\'e tıklandı!');
            }),
            vscode.commands.registerCommand('kebapSidebarView.updateKebap', async (item) => {
                vscode.window.showInformationMessage(`Started Update Package: ${item.KebapPackage.name}`);
                let terminal = vscode.window.terminals.find(t => t.name === "Kebap Update");
                if (!terminal) {
                    terminal = vscode.window.createTerminal({ name: "Kebap Update" });
                }

                let execution: vscode.TerminalShellExecution | undefined = undefined;
                // Send command to terminal that has been alive for a while
                const commandLine = `npm install ${item.KebapPackage.name}@${item.KebapPackage.lastVersion.ToString()}`;
                if (terminal.shellIntegration) {
                    execution = terminal.shellIntegration.executeCommand(commandLine);
                } else {
                    terminal.sendText(commandLine);
                    // Without shell integration, we can't know when the command has finished or what the
                    // exit code was.
                }

                const stream = execution?.read();
                if (stream) {
                    let isErr = false;
                    const decoder = new TextDecoder('utf-8');
                    for await (const chunk of stream) {
                        try {
                            // ANSI kaçış karakterlerini kaldır (OSC `\x1b]0;...` dahil)
                            const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?\x07)/g;
                            // Gereksiz `\r`, `0;`, `` ve boşlukları temizleme
                            const extraCharsRegex = /^\d+;/g;
                            const cleanData = chunk.replace(ansiRegex, "").replace(extraCharsRegex, "").replace("", "").trim();
                            if (cleanData.includes("npm error ERESOLVE could not resolve")) {
                                isErr = true;
                            } else if (cleanData.includes("npm WARN!")) {
                                isErr = true;
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    if (isErr) {
                        vscode.window.showInformationMessage("")
                        vscode.window.showErrorMessage("Paket güncelleme başarısız oldu.");
                    }
                    else {
                        vscode.window.showInformationMessage("Paket güncelleme başarılı");
                    }
                }
            })
        );
    });
}

function createItem(kebapPack: KebapPackage, collapsed: vscode.TreeItemCollapsibleState) {
    const item = new KebapTreeItem(kebapPack, collapsed);
    item.command = { command: 'kebapSidebarView.itemClick', title: kebapPack.name + ' tıklandı', arguments: [item] };
    return item;
}

// https://registry.npmjs.org/primeng

export class KebapSidebarView implements vscode.TreeDataProvider<KebapTreeItem> {

    private _kebapPackage: KebapPackage[];
    /**
     *
     */
    constructor(kebapPackage: KebapPackage[]) {
        this._kebapPackage = kebapPackage;
    }

    // TreeView'da gösterilecek öğeleri döndürür
    getTreeItem(element: KebapTreeItem): KebapTreeItem {
        return element;
    }

    // TreeView'ın alt öğelerini döndürür
    getChildren(element?: KebapTreeItem): Thenable<KebapTreeItem[]> {
        return new Promise((resolve, reject) => {
            if (element) {
                // Alt öğeler (isteğe bağlı)
                const subDependenciesPackeges: KebapTreeItem[] = [];
                const subItem = element.KebapPackage;
                if (subItem) {
                    const currentKebapDep = subItem.versions[subItem.currrentVersion].dependencies;
                    const lastKebapDep = subItem.versions[subItem.lastVersion.ToString()].dependencies;

                    if (currentKebapDep) {
                        for (const key in currentKebapDep) {
                            const lastVersion = lastKebapDep[key];
                            const version = currentKebapDep[key];
                            const kPackage = new KebapPackage();
                            kPackage.name = key;
                            kPackage.currrentVersion = version;
                            kPackage.versionObject = new KebapVersion(version);
                            kPackage.lastVersion = new KebapVersion(lastVersion);
                            kPackage.ShowingLastVersion = true;//kPackage.lastVersion.Compare(kPackage.versionObject) > 0;              
                            subDependenciesPackeges.push(
                                createItem(kPackage, vscode.TreeItemCollapsibleState.None)
                            );
                        }
                    }
                }
                resolve(subDependenciesPackeges);
            }
            else {
                // Ana öğeler
                const appDependenciesPackeges: KebapTreeItem[] = [];
                this._kebapPackage.forEach(dep => {
                    const kebapDeps = dep.versions[dep.currrentVersion].dependencies;
                    const depCount = kebapDeps ? Object.keys(kebapDeps).length : 0;
                    appDependenciesPackeges.push(
                        createItem(dep, depCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None));
                });
                resolve(appDependenciesPackeges);
            }
        });
    }
}

function readPackageJson(): Promise<KebapPackageJson> {
    return new Promise((resolve, reject) => {
        // Get the workspace folder (assuming the extension is installed in a workspace)
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if (workspaceFolder) {
            const packageJsonPath = path.join(workspaceFolder, 'package.json');
            // Read the package.json file
            fs.readFile(packageJsonPath, 'utf8', async (err, data) => {
                if (err) {
                    vscode.window.showErrorMessage(`Failed to read package.json: ${err.message}`);
                    reject(err);
                    return;
                }

                try {
                    // Parse the JSON data from the file
                    const packageJson = JSON.parse(data) as PackageJson;
                    vscode.window.showInformationMessage(`Project name: ${packageJson.name} Actived`);
                    const kebapPackageJson = new KebapPackageJson();
                    kebapPackageJson.name = packageJson.name;
                    kebapPackageJson.version = packageJson.version;
                    kebapPackageJson.dependencies = [];
                    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
                    for (const key in packageJson.dependencies) {
                        let version = packageJson.dependencies[key];
                        if (version[0] === "^") {
                            version = version.substring(1, version.length);
                        }
                        const kebapPackage = new KebapPackage();
                        kebapPackage.name = key;
                        kebapPackage.currrentVersion = version;
                        statusBarItem.text = "Kebap : $(loading~spin) Etler Diziliyor...." + key + "@v" + version;
                        statusBarItem.tooltip = new vscode.MarkdownString('[google](https://www.google.com)');
                        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                        statusBarItem.show();
                        await readPackageDetails(kebapPackage.name, kebapPackage.currrentVersion)
                            .then(detail => {
                                kebapPackage.versions = detail.versions;
                                kebapPackage.versionObject = new KebapVersion(kebapPackage.currrentVersion);
                                for (const key in detail.versions) {
                                    const ver = detail.versions[key];
                                    ver.versionObject = new KebapVersion(ver.version);

                                    if ((!ver.versionObject.preRelease && IsJustStabilVersions) ||
                                        (ver.versionObject.preRelease && !IsJustStabilVersions)) {
                                        if (!kebapPackage.lastVersion) {
                                            kebapPackage.lastVersion = ver.versionObject;
                                        }
                                        else if (kebapPackage.lastVersion.Compare(ver.versionObject)) {
                                            kebapPackage.lastVersion = ver.versionObject;
                                        }
                                    }
                                }
                                kebapPackage.IsUploadable = kebapPackage.lastVersion.Compare(kebapPackage.versionObject) > 0;
                                kebapPackage.ShowingLastVersion = kebapPackage.IsUploadable;
                            });
                        statusBarItem.hide();
                        kebapPackageJson.dependencies.push(kebapPackage);
                    }
                    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                    statusBarItem.text = "Kebap : $(flame~loading) Kebap Pişiyor";
                    statusBarItem.show();
                    setTimeout(() => {
                        statusBarItem.hide();
                        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                        statusBarItem.text = "Kebap : $(sparkle) Kebap Hazır";
                        statusBarItem.show();
                        setTimeout(() => {
                            statusBarItem.hide();
                        }, 2000);
                    }, 2000);

                    resolve(kebapPackageJson);
                } catch (jsonErr: any) {
                    if (jsonErr?.message) {
                        vscode.window.showErrorMessage(`Error parsing package.json: ${jsonErr.message}`);
                    }
                    reject(jsonErr);
                }
            });
        } else {
            vscode.window.showErrorMessage(`Workspace Not Found!`);
            reject(new Error('Workspace Not Found!'));
        }
    });
}

function readPackageDetails(packageName: string, version: string): Promise<KebapPackage> {
    return new Promise((resolve, reject) => {
        // Get the workspace folder (assuming the extension is installed in a workspace)
        // resolve (mockData as KebapPackage);
        fetch(`https://registry.npmjs.org/${packageName}`)
            .then(response => response.json() as Promise<KebapPackage>)
            .then(pack => {
                console.log(pack.name);
                resolve(pack);
            });
    });
}

// This method is called when your extension is deactivated
export function deactivate() {
    console.log('Uzantı devre dışı bırakıldı.');
}

class KebapTreeItem extends vscode.TreeItem {
    constructor(
        public KebapPackage: KebapPackage,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(KebapPackage.name + " " + KebapPackage.currrentVersion, collapsibleState);
        this.tooltip = `${this.label}`;
        this.contextValue = KebapPackage.IsUploadable ? 'updatable' : 'not-updatable';
        this.description = this.KebapPackage.lastVersion && KebapPackage.ShowingLastVersion ? " --> " + this.KebapPackage.lastVersion?.ToString() : "";
    }
}