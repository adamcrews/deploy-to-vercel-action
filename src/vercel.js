const core = require('@actions/core')
const os = require('os')
const path = require('path')
const { exec, removeSchema } = require('./helpers')

const {
	VERCEL_TOKEN,
	PRODUCTION,
	VERCEL_SCOPE,
	VERCEL_ORG_ID,
	VERCEL_PROJECT_ID,
	VERCEL_PROJECT_NAME, // eslint-disable-line no-unused-vars
	SHA,
	USER,
	REPOSITORY,
	REF,
	TRIM_COMMIT_MESSAGE,
	BUILD_ENV,
	PREBUILT,
	WORKING_DIRECTORY,
	FORCE
} = require('./config')

// The CLI is fetched at runtime with `npx` rather than bundled, so `vercel` is a devDependency
// purely to give Dependabot a version to bump. ncc inlines this value at build time.
const VERCEL_CLI_RANGE = require('../package.json').devDependencies.vercel
const VERCEL_CLI_VERSION = VERCEL_CLI_RANGE.replace(/^[^\d]*/, '')

if (!(/^\d+\.\d+\.\d+/).test(VERCEL_CLI_VERSION)) {
	throw new Error(`Expected an exact Vercel CLI version in package.json devDependencies, got "${ VERCEL_CLI_RANGE }"`)
}

const parseDeploymentUrl = (output) => {
	const urls = output.match(/https?:\/\/[^\s]+/g)
	if (!urls || urls.length === 0) {
		throw new Error(`Could not parse deploymentUrl from Vercel CLI output: ${ output }`)
	}

	return removeSchema(urls[urls.length - 1])
}

const fetchJson = async (url) => {
	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${ VERCEL_TOKEN }`
		}
	})

	if (!res.ok) {
		const body = await res.text()
		throw new Error(`Vercel API request failed (${ res.status } ${ res.statusText }): ${ body }`)
	}

	return res.json()
}

const init = () => {
	core.info('Setting environment variables for Vercel CLI')
	core.exportVariable('VERCEL_ORG_ID', VERCEL_ORG_ID)
	core.exportVariable('VERCEL_PROJECT_ID', VERCEL_PROJECT_ID)

	core.info(`Using Vercel CLI ${ VERCEL_CLI_VERSION }`)

	let deploymentUrl

	const runVercel = (args) => {
		// npx must not run inside the consumer repo. Their package.json overrides (e.g.
		// webpack) make npm 11 fail with EOVERRIDE before the CLI starts. Point Vercel
		// at the project with --cwd instead.
		const projectDir = path.resolve(WORKING_DIRECTORY || process.cwd())
		const npxCwd = process.env.RUNNER_TEMP || os.tmpdir()

		return exec('npx', [ '--yes', `vercel@${ VERCEL_CLI_VERSION }`, '--cwd', projectDir, ...args ], npxCwd)
	}

	const deploy = async (commit) => {
		// --yes skips setup prompts; VERCEL_ORG_ID / VERCEL_PROJECT_ID select the target (required since CLI 55).
		let commandArguments = [ `--token=${ VERCEL_TOKEN }`, '--yes' ]

		if (VERCEL_SCOPE) {
			commandArguments.push(`--scope=${ VERCEL_SCOPE }`)
		}

		if (PRODUCTION) {
			commandArguments.push('--prod')
		}

		if (PREBUILT) {
			commandArguments.push('--prebuilt')
		}

		if (FORCE) {
			commandArguments.push('--force')
		}

		if (commit) {
			const metadata = [
				`githubCommitAuthorName=${ commit.authorName }`,
				`githubCommitAuthorLogin=${ commit.authorLogin }`,
				`githubCommitMessage=${ TRIM_COMMIT_MESSAGE ? commit.commitMessage.split(/\r?\n/)[0] : commit.commitMessage }`,
				`githubCommitOrg=${ USER }`,
				`githubCommitRepo=${ REPOSITORY }`,
				`githubCommitRef=${ REF }`,
				`githubCommitSha=${ SHA }`,
				`githubOrg=${ USER }`,
				`githubRepo=${ REPOSITORY }`,
				`githubDeployment=1`
			]

			metadata.forEach((item) => {
				commandArguments = commandArguments.concat([ '--meta', item ])
			})
		}

		if (BUILD_ENV) {
			BUILD_ENV.forEach((item) => {
				commandArguments = commandArguments.concat([ '--build-env', item ])
			})
		}

		core.info('Starting deploy with Vercel CLI')
		const output = await runVercel(commandArguments)
		deploymentUrl = parseDeploymentUrl(output)

		return deploymentUrl
	}

	const assignAlias = async (aliasUrl) => {
		core.debug(`Starting: assignAlias`)
		core.debug(`assignAlias aliasUrl: ${ aliasUrl }`)
		const commandArguments = [ `--token=${ VERCEL_TOKEN }`, '--yes', 'alias', 'set', deploymentUrl, removeSchema(aliasUrl) ]

		if (VERCEL_SCOPE) {
			commandArguments.push(`--scope=${ VERCEL_SCOPE }`)
		}

		const output = await runVercel(commandArguments)

		return output
	}

	const getDeployment = async () => {
		const url = `https://api.vercel.com/v13/deployments/${ deploymentUrl }${ VERCEL_ORG_ID ? `?teamId=${ VERCEL_ORG_ID }` : '' }`

		return fetchJson(url)
	}

	const getProject = async (projectName) => {
		const url = `https://api.vercel.com/v9/projects/${ projectName }${ VERCEL_ORG_ID ? `?teamId=${ VERCEL_ORG_ID }` : '' }`

		return fetchJson(url)
	}

	return {
		deploy,
		assignAlias,
		deploymentUrl,
		getDeployment,
		getProject
	}
}

module.exports = {
	init
}