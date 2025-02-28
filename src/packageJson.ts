export class PackageJson{
    public name: string;
    public version: string;
    public dependencies: Record<string, string>;
    public devDependencies: Record<string, string>;
}

export class KebapPackageJson{
    public name: string;
    public version: string;
    public dependencies: KebapPackage[];
    public devDependencies: KebapPackage[];
}

export class KebapPackage{
    public name: string;
    public version: string;
    public currrentVersion: string;
    public dependencies: Record<string, string>;
    public versions: Record<string, KebapPackage>;
    public lastVersion: string;
}
