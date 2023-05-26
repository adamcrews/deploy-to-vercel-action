const core = require('@actions/core')
const github = require('@actions/github')
const parser = require('action-input-parser')
require('dotenv').config()

const IS_PR = [ 'pull_request', 'pull_request_target' ].includes(github.context.eventName)

const context = {
	ALIAS_DOMAINS: parser.getInput({
		key: 'ALIAS_DOMAINS',
		type: 'array',
		disableable: true
	}),
	ATTACH_COMMIT_METADATA: parser.getInput({
		key: 'ATTACH_COMMIT_METADATA',
		type: 'boolean',
		default: true
	}),
	BUILD_ENV: parser.getInput({
		key: 'BUILD_ENV',
		type: 'array'
	}),
	CREATE_COMMENT: parser.getInput({
		key: 'CREATE_COMMENT',
		type: 'boolean',
		default: true
	}),
	DELETE_EXISTING_COMMENT: parser.getInput({
		key: 'DELETE_EXISTING_COMMENT',
		type: 'boolean',
		default: true
	}),
	DEPLOY_PR_FROM_FORK: parser.getInput({
		key: 'DEPLOY_PR_FROM_FORK',
		type: 'boolean',
		default: false
	}),
	FORCE: parser.getInput({
		key: 'FORCE',
		type: 'boolean',
		default: false
	}),
	GITHUB_DEPLOYMENT: parser.getInput({
		key: 'GITHUB_DEPLOYMENT',
		type: 'boolean',
		default: true
	}),
	GITHUB_DEPLOYMENT_ENV: parser.getInput({
		key: 'GITHUB_DEPLOYMENT_ENV'
	}),
	GITHUB_REPOSITORY: parser.getInput({
		key: 'GITHUB_REPOSITORY',
		required: true
	}),
	GITHUB_TOKEN: parser.getInput({
		key: [ 'GITHUB_TOKEN', 'GH_PAT' ],
		required: true
	}),
	PREBUILT: parser.getInput({
		key: 'PREBUILT',
		type: 'boolean',
		default: false
	}),
	PR_LABELS: parser.getInput({
		key: 'PR_LABELS',
		default: [ 'deployed' ],
		type: 'array',
		disableable: true
	}),
	PR_PREVIEW_DOMAIN: parser.getInput({
		key: 'PR_PREVIEW_DOMAIN'
	}),
	PRODUCTION: parser.getInput({
		key: 'PRODUCTION',
		type: 'boolean',
		default: !IS_PR
	}),
	RUNNING_LOCAL: process.env.RUNNING_LOCAL === 'true',
	TRIM_COMMIT_MESSAGE: parser.getInput({
		key: 'TRIM_COMMIT_MESSAGE',
		type: 'boolean',
		default: false
	}),
	UPDATE_EXISTING_COMMENT: parser.getInput({
		key: 'UPDATE_EXISTING_COMMENT',
		type: 'boolean',
		default: false
	}),
	VERCEL_ORG_ID: parser.getInput({
		key: 'VERCEL_ORG_ID',
		required: true
	}),
	VERCEL_PROJECT_ID: parser.getInput({
		key: 'VERCEL_PROJECT_ID',
		required: true
	}),
	VERCEL_PROJECT_NAME: parser.getInput({
		key: 'VERCEL_PROJECT_NAME',
		required: true
	}),
	VERCEL_SCOPE: parser.getInput({
		key: 'VERCEL_SCOPE'
	}),
	VERCEL_TOKEN: parser.getInput({
		key: 'VERCEL_TOKEN',
		required: true
	}),
	WORKING_DIRECTORY: parser.getInput({
		key: 'WORKING_DIRECTORY'
	})
}

const setDynamicVars = () => {
	context.COMMENT_TITLE = `This PR has been deployed to Vercel: ${ context.VERCEL_PROJECT_NAME }`
	context.REPOSITORY = context.GITHUB_REPOSITORY.split('/')[1]
	context.USER = context.GITHUB_REPOSITORY.split('/')[0]

	// If running the action locally, use env vars instead of github.context
	if (context.RUNNING_LOCAL) {
		context.ACTOR = process.env.ACTOR || context.USER
		context.BRANCH = process.env.BRANCH || 'master'
		context.IS_FORK = process.env.IS_FORK === 'true' || false
		context.IS_PR = process.env.IS_PR === 'true' || false
		context.LOG_URL = process.env.LOG_URL || `https://github.com/${ context.USER }/${ context.REPOSITORY }`
		context.PR_NUMBER = process.env.PR_NUMBER || undefined
		context.PRODUCTION = process.env.PRODUCTION === 'true' || !context.IS_PR
		context.REF = process.env.REF || 'refs/heads/master'
		context.SHA = process.env.SHA || 'XXXXXXX'
		context.TRIM_COMMIT_MESSAGE = process.env.TRIM_COMMIT_MESSAGE === 'true' || false

		return
	}

	context.IS_PR = IS_PR
	context.LOG_URL = `https://github.com/${ context.USER }/${ context.REPOSITORY }/actions/runs/${ process.env.GITHUB_RUN_ID }`

	// Use different values depending on if the Action was triggered by a PR
	if (context.IS_PR) {
		context.ACTOR = github.context.payload.pull_request.user.login
		context.BRANCH = github.context.payload.pull_request.head.ref
		context.IS_FORK = github.context.payload.pull_request.head.repo.full_name !== context.GITHUB_REPOSITORY
		context.PR_NUMBER = github.context.payload.number
		context.REF = github.context.payload.pull_request.head.ref
		context.SHA = github.context.payload.pull_request.head.sha
	} else {
		context.ACTOR = github.context.actor
		context.BRANCH = github.context.ref.substr(11)
		context.REF = github.context.ref
		context.SHA = github.context.sha
	}
}

setDynamicVars()

core.setSecret(context.GITHUB_TOKEN)
core.setSecret(context.VERCEL_TOKEN)

core.debug(
	JSON.stringify(
		context,
		null,
		2
	)
)

module.exports = context