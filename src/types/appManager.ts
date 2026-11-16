export interface InstalledApp {
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  isSystemApp: boolean;
  sourceDir: string;
  size: number;
  firstInstallTime: number;
  lastUpdateTime: number;
}

export interface StandaloneApk {
  packageName: string;
  appName: string;
  versionName: string;
  versionCode: number;
  targetSdkVersion: number;
  size: number;
  path: string;
  permissions: string[];
}

