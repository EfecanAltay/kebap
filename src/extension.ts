// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PackageJson, KebapPackageJson, KebapPackage } from './packageJson';


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
            })
        );
    });
}

function createItem(itemName: string, version: string, collapsed: vscode.TreeItemCollapsibleState) {
    const item = new KebapTreeItem(itemName, version, collapsed);
    item.tooltip = itemName;
    item.contextValue = itemName + version;
    item.command = { command: 'kebapSidebarView.itemClick', title: itemName + ' tıklandı', arguments: [item] };
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
                const subItem = this._kebapPackage.find(x => x.name + x.currrentVersion === element.contextValue);
                if (subItem) {
                    const kebapDeps = subItem.versions[subItem.currrentVersion].dependencies;
                    if (kebapDeps) {
                        for (const key in kebapDeps) {
                            let version = kebapDeps[key];
                            subDependenciesPackeges.push(
                                createItem(key, version, vscode.TreeItemCollapsibleState.None));
                        }
                    }
                }
                resolve(subDependenciesPackeges);
            }
            else {
                // Ana öğeler
                const appDependenciesPackeges: KebapTreeItem[] = [];
                this._kebapPackage.forEach(dep => {
                    appDependenciesPackeges.push(
                        createItem(dep.name, dep.currrentVersion, vscode.TreeItemCollapsibleState.Collapsed));
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
                                for (const key in detail.versions) {
                                    const ver = detail.versions[key];
                                    if (!kebapPackage.lastVersion) {
                                        kebapPackage.lastVersion = ver.version;
                                    }
                                    else if (kebapPackage.lastVersion < ver.version) {
                                        kebapPackage.lastVersion = ver.version;
                                    }
                                }
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
        public readonly label: string,
        private version: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}-${this.version}`;
        this.description = this.version;
    }
}