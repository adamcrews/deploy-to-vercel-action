const core = require('@actions/core')
const { spawn } = require('child_process')

const execCmd = (command, args, cwd) => {
	core.debug(`EXEC: "${ command } ${ args.join(' ') }" in ${ cwd || '.' }`)
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { cwd, env: process.env })
		let stdout = ''
		let stderr = ''

		child.stdout.on('data', (data) => {
			const text = data.toString()
			core.debug(text)
			stdout += text
		})

		child.stderr.on('data', (data) => {
			const text = data.toString()
			core.debug(text)
			stderr += text
		})

		child.on('error', (err) => {
			reject(err)
		})

		child.on('close', (code) => {
			code !== 0 ? reject(new Error(stderr || `Command failed with exit code ${ code }`)) : resolve(stdout.trim())
		})
	})
}

const addSchema = (url) => {
	const regex = /^https?:\/\//
	if (!regex.test(url)) {
		return `https://${ url }`
	}

	return url
}

const removeSchema = (url) => {
	core.debug(`Starting: removeSchema`)
	const regex = /^https?:\/\//
	core.debug(`removeSchema url: ${ url }`)
	core.debug(`removeSchema output: ${ url.replace(regex, '') }`)
	return url.replace(regex, '')
}

module.exports = {
	exec: execCmd,
	addSchema,
	removeSchema
}