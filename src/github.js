const core = require('@actions/core')
const github = require('@actions/github')

const config = require('./config')

const {
	COMMENT_TITLE,
	GITHUB_DEPLOYMENT_ENV,
	LOG_URL,
	PR_LABELS,
	PR_NUMBER,
	PRODUCTION,
	REF,
	REPOSITORY,
	USER
} = config

const init = () => {
	const myToken = core.getInput('GITHUB_TOKEN', { required: true })
	const client = github.getOctokit(myToken, { previews: [ 'flash', 'ant-man' ] })

	let deploymentId

	const createDeployment = async () => {
		const deployment = await client.rest.repos.createDeployment({
			owner: USER,
			repo: REPOSITORY,
			ref: REF,
			required_contexts: [],
			environment: GITHUB_DEPLOYMENT_ENV ? GITHUB_DEPLOYMENT_ENV : (PRODUCTION ? 'Production' : 'Preview'), // eslint-disable-line no-nested-ternary
			description: 'Deploy to Vercel',
			auto_merge: false
		})

		deploymentId = deployment.data.id

		return deployment.data
	}

	const updateDeployment = async (status, url) => {
		core.debug(`Starting: updateDeployment`)
		if (!deploymentId) return

		const deploymentStatus = await client.rest.repos.createDeploymentStatus({
			owner: USER,
			repo: REPOSITORY,
			deployment_id: deploymentId,
			state: status,
			log_url: LOG_URL,
			environment_url: url || LOG_URL,
			description: 'Starting deployment to Vercel'
		})

		return deploymentStatus.data
	}

	const findExistingComment = async () => {
		const { data } = await client.rest.issues.listComments({
			owner: USER,
			repo: REPOSITORY,
			issue_number: PR_NUMBER
		})
		core.debug(`findExistingComment data: ${ JSON.stringify(data) }`)
		return data.find((comment) =>
		// comment.body.includes(`This PR has been deployed to Vercel: ${ PR_PREVIEW_DOMAIN }`)
			comment.body.includes(COMMENT_TITLE)
		)
	}

	const deleteExistingComment = async () => {
		const comment = await findExistingComment()
		if (comment) {
			await client.rest.issues.deleteComment({
				owner: USER,
				repo: REPOSITORY,
				comment_id: comment.id
			})

			return comment.id
		}
	}

	const createComment = async (body, updateExisting = false) => {
		core.debug(`Starting: createComment`)
		core.debug(`createComment body: ${ body }`)
		// Remove indentation
		const dedented = body.replace(/^[^\S\n]+/gm, '')

		const commentParams = {
			owner: USER,
			repo: REPOSITORY,
			issue_number: PR_NUMBER,
			body: dedented
		}

		const existingComment = updateExisting ? await findExistingComment() : null
		core.debug(`existingComment: ${ existingComment }`)
		const comment = existingComment ?
			await client.rest.issues.updateComment({
				comment_id: existingComment.id, ...commentParams
			}) :
			await client.rest.issues.createComment(commentParams)

		core.debug(`comment: ${ comment }`)

		return comment.data
	}

	const addLabel = async () => {
		const label = await client.rest.issues.addLabels({
			owner: USER,
			repo: REPOSITORY,
			issue_number: PR_NUMBER,
			labels: PR_LABELS
		})

		return label.data
	}

	const getCommit = async () => {
		const { data } = await client.rest.repos.getCommit({
			owner: USER,
			repo: REPOSITORY,
			ref: REF
		})

		return {
			authorName: data.commit.author.name,
			authorLogin: data.author.login,
			commitMessage: data.commit.message
		}
	}

	return {
		client,
		createDeployment,
		updateDeployment,
		deleteExistingComment,
		createComment,
		addLabel,
		getCommit
	}
}

module.exports = {
	init
}