const path = require('path')
const webpack = require('webpack')

/**@type {import('webpack').Configuration}*/
const config = {
	target: 'node', // VS Code extensions run in a Node.js-context
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

	entry: './src/extension.ts', // the entry point of this extension
	output: {
		// the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: path.resolve(__dirname, 'out'),
		filename: 'extension.js',
		libraryTarget: 'commonjs2',
		clean: true // Clean the output directory before emit
	},
	externals: {
		vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded.
	},
	resolve: {
		// support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
		extensions: ['.ts', '.js'],
		alias: {
			'@': path.resolve(__dirname, 'src')
		}
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							compilerOptions: {
								module: 'esnext'
							}
						}
					}
				]
			}
		]
	},
	devtool: 'nosources-source-map',
	infrastructureLogging: {
		level: 'log' // enables logging required for problem matchers
	},
	plugins: [
		new webpack.DefinePlugin({
			'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
		})
	]
}

// Production mode configuration
if (process.env.NODE_ENV === 'production') {
	config.mode = 'production'
	config.devtool = false
	config.optimization = {
		minimize: true,
		sideEffects: false,
		usedExports: true,
		providedExports: true,
		concatenateModules: true,
		flagIncludedChunks: true,
		mergeDuplicateChunks: true,
		removeAvailableModules: true,
		removeEmptyChunks: true,
		splitChunks: false // Don't split chunks for extension
	}
	config.performance = {
		hints: 'warning',
		maxEntrypointSize: 1024 * 1024, // 1MB
		maxAssetSize: 1024 * 1024 // 1MB
	}
}

module.exports = config
