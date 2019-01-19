let AWS = require('aws-sdk');
let parser = require("mailparser").simpleParser;

//
//	Initialize S3.
//
let s3 = new AWS.S3({
	apiVersion: '2006-03-01'
});

//
//	This lambda will read each copied raw email, and generate a HTML version
//	for easy readability.
//
exports.handler = (event) => {

	//
	//
	//
	let s3_key = event.Records[0].s3.object.key

	//
	//
	//
	let plus_to_space = s3_key.replace(/\+/g, ' ');

	//
	//
	//
	let unescaped_key = decodeURIComponent(plus_to_space);

	//
	//	1.	This JS object will contain all the data within the chain.
	//
	let container = {
		bucket: event.Records[0].s3.bucket.name,
		key: unescaped_key,
		parsed: {
			html: "",
			text: ""
		}
	}

	console.log(container);

	//
	//	->	Start the chain.
	//
	load_the_email(container)
		.then(function(container) {

			return parse_the_email(container);

		}).then(function(container) {

			return save_html(container);

		}).then(function(container) {

			return save_text(container);

		}).then(function(container) {

			return true;

		}).catch(function(error) {

			console.error(error);

			return false;

		});

};

//	 _____    _____     ____    __  __   _____    _____   ______    _____
//	|  __ \  |  __ \   / __ \  |  \/  | |_   _|  / ____| |  ____|  / ____|
//	| |__) | | |__) | | |  | | | \  / |   | |   | (___   | |__    | (___
//	|  ___/  |  _  /  | |  | | | |\/| |   | |    \___ \  |  __|    \___ \
//	| |      | | \ \  | |__| | | |  | |  _| |_   ____) | | |____   ____) |
//	|_|      |_|  \_\  \____/  |_|  |_| |_____| |_____/  |______| |_____/
//

//
//	Load the email from S3.
//
function load_the_email(container)
{
	return new Promise(function(resolve, reject) {

		console.info("load_the_email");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: container.bucket,
			Key: container.key
		};

		console.log(params)

		//
		//	->	Execute the query.
		//
		s3.getObject(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				return reject(error);
			}

			//
			//	2.	Save the email for the next promise
			//
			container.raw_email = data.Body

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}

//
//	Convert the raw email in to HTML
//
function parse_the_email(container)
{
	return new Promise(function(resolve, reject) {

		console.info("parse_the_email");

		//
		//	1.	Parse the email and extract all the it necessary.
		//
		parser(container.raw_email, function(error, parsed) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				return reject(error);
			}

			//
			//	2.	Save the parsed email for the next promise.
			//
			container.parsed.html = parsed.html;
			container.parsed.text = parsed.text;

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}

//
//	Save the html version of the email
//
function save_html(container)
{
	return new Promise(function(resolve, reject) {

		console.info("save_html");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: container.bucket,
			Key: container.key + ".html",
			Body: container.parsed.html
		};

		//
		//	->	Execute the query.
		//
		s3.putObject(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				return reject(error);
			}

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}

//
//	Save the text version of the email
//
function save_text(container)
{
	return new Promise(function(resolve, reject) {

		console.info("save_text");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: container.bucket,
			Key: container.key + ".txt",
			Body: container.parsed.text
		};

		//
		//	->	Execute the query.
		//
		s3.putObject(params, function(error, data) {

			//
			//	1.	Check for internal errors.
			//
			if(error)
			{
				return reject(error);
			}

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

	});
}
