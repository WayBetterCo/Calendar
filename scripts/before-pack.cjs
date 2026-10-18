module.exports = async function beforePack(context) {
  const { writeReleaseEnvironment } = await import('./write-release-env.mjs');
  writeReleaseEnvironment(context.packager.projectDir);
  if (context.electronPlatformName === 'darwin' && !process.env.CSC_LINK && !process.env.CSC_NAME) {
    // Ad-hoc local builds need no hardened runtime. Real Developer ID builds
    // retain electron-builder's hardened runtime and notarization defaults.
    Object.assign(context.packager.platformSpecificBuildOptions, { identity: '-', hardenedRuntime: false });
  }
};
