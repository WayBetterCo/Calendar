module.exports = async function beforePack(context) {
  // Actions supplies unset secrets as empty strings. electron-builder treats an
  // empty certificate link as a path to the project directory, then fails.
  for (const name of ['CSC_LINK', 'WIN_CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_KEY_PASSWORD', 'CSC_NAME', 'CSC_KEYCHAIN', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
    if (process.env[name] === '') delete process.env[name];
  }
  const { writeReleaseEnvironment } = await import('./write-release-env.mjs');
  writeReleaseEnvironment(context.packager.projectDir);
  if (context.electronPlatformName === 'darwin' && !process.env.CSC_LINK && !process.env.CSC_NAME) {
    // Ad-hoc local builds need no hardened runtime. Real Developer ID builds
    // retain electron-builder's hardened runtime and notarization defaults.
    Object.assign(context.packager.platformSpecificBuildOptions, { identity: '-', hardenedRuntime: false });
  }
};
