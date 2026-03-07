const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix per React Navigation v7
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];
config.resolver.assetExts = ['glb', 'gltf', 'png', 'jpg', 'jpeg', 'webp', 'ttf', 'otf'];

module.exports = config;
