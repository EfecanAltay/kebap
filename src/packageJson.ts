export class PackageJson {
    public name: string;
    public version: string;
    public dependencies: Record<string, string>;
    public devDependencies: Record<string, string>;
}

export class KebapPackageJson {
    public name: string;
    public version: string;
    public dependencies: KebapPackage[];
    public devDependencies: KebapPackage[];
}

export class KebapPackage {
    public name: string;
    public version: string;
    public versionObject: KebapVersion;
    public currrentVersion: string;
    public dependencies: Record<string, string>;
    public versions: Record<string, KebapPackage>;
    public lastVersion: KebapVersion;
    public IsUploadable: boolean;
}

export class KebapVersion {
    public major: number;
    public minor: number;
    public patch: number;
    public preRelease?: KebapPreRelease;
    /**
     *
     */
    constructor(strVersion: string) {
        this.Parse(strVersion);
    }

    public Parse(strVersion: string): KebapVersion {
        const mainVersion = strVersion.split("-");
        let fVersion = mainVersion[0].split(".");
        if (fVersion.length > 0) {
            this.major = Number.parseInt(fVersion[0]);
        }
        if (fVersion.length > 1) {
            this.minor = Number.parseInt(fVersion[1]);
        }
        if (fVersion.length > 2) {
            this.patch = Number.parseInt(fVersion[2]);
        }
        const preReleaseStr = mainVersion[1];
        if (preReleaseStr) {
            let ssVersion = preReleaseStr.split(".");
            this.preRelease = new KebapPreRelease();
            this.preRelease.type = ssVersion[0];
            this.preRelease.patch = ssVersion[1] ? Number.parseInt(ssVersion[1]) : 0;
        }
        return this;
    }

    public ToString(): string {
        if (this.preRelease) { return `${this.major}.${this.minor}.${this.patch}-${this.preRelease.ToString()}`; }
        else { return `${this.major}.${this.minor}.${this.patch}`; }
    }

    public Compare(version: KebapVersion): number {
        if (this.major > version.major) {
            return 1;
        }
        else if (this.major < version.major) {
            return -1;
        }
        else if (this.minor > version.minor) {
            return 1;
        }
        else if (this.minor < version.minor) {
            return -1;
        }
        else if (this.patch > version.patch) {
            return 1;
        }
        else if (this.patch < version.patch) {
            return -1;
        }
        else if (this.preRelease) {
            if (version.preRelease) {
                if (this.preRelease.type === version.preRelease.type) {
                    if (this.preRelease.patch > version.preRelease.patch) {
                        return 1;
                    }
                    else if (this.preRelease.patch < version.preRelease.patch) {
                        return -1;
                    }
                }
                else if (this.preRelease.type === "alpha") {
                    return -1;
                }
                else if (this.preRelease.type === "beta") {
                    if (version.preRelease.type === "alpha") {
                        return 1;
                    }
                    else if (version.preRelease.type === "beta") {
                        if (this.preRelease.patch > version.preRelease.patch) {
                            return 1;
                        }
                        else if (this.preRelease.patch < version.preRelease.patch) {
                            return -1;
                        }
                    }
                }
                else if (this.preRelease.type === "rc") {
                    if (version.preRelease.type === "alpha" || version.preRelease.type === "beta") {
                        return 1;
                    }
                    else if (version.preRelease.type === "rc") {
                        if (this.preRelease.patch > version.preRelease.patch) {
                            return 1;
                        }
                        else if (this.preRelease.patch < version.preRelease.patch) {
                            return -1;
                        }
                    }
                }
            }
            else {
                return 1;
            }
        }
        else if (version.preRelease) {
            return -1;
        }
        return 0;
    }
}

export class KebapPreRelease {
    public type: string;
    public patch: number;

    public ToString(): string {
        return `${this.type}.${this.patch}`;
    }
}