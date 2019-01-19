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
	//	1.	To a simple variable.
	//
	let s3_key = event.Records[0].s3.object.key;

	//
	//	2.	Replace all the + characters to a space one.
	//
	let plus_to_space = s3_key.replace(/\+/g, ' ');

	//
	//	3.	Unescape the HTML URI style string.
	//
	let unescaped_key = decodeURIComponent(plus_to_space);

	//
	//	4.	This JS object will contain all the data within the chain.
	//
	let container = {
		bucket: event.Records[0].s3.bucket.name,
		key: unescaped_key,
		parsed: {
			html: "",
			text: "",
			attachments: []
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

			return save_text(container);

		}).then(function(container) {

			return save_html(container);

		}).then(function(container) {

			return save_attachments(container);

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
			container.parsed.attachments = parsed.attachments;

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

		console.log(params);

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
//	Save the html version of the email
//
function save_html(container)
{
	return new Promise(function(resolve, reject) {

		//
		//	<>> When the body of an email have only one version, meaning it
		//		dose have only the pure text version and no HTML one.
		//
		//		Nodemailer won't generate the HTML for you, it just grabs
		//		what is in the Email body.
		//
		//		So, this value will be false, when there is no HTML content in
		//		the email.
		//
		if(!container.parsed.html)
		{
			//
			//	->	Move to the next chain.
			//
			return resolve(container);
		}

		console.info("save_html");

		//
		//	1.	Set the query.
		//
		let params = {
			Bucket: container.bucket,
			Key: container.key + ".html",
			Body: container.parsed.html
		};

		console.log(params)

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
//	Save all the attachments
//
function save_attachments(container)
{
	return new Promise(function(resolve, reject) {

		console.info("save_attachments");

		//
		//	Start the loop which will download all the ads.
		//
		loop(function(error) {

			//
			//	<<> Check if there was an error.
			//
			if(error)
			{
				//
				//	->	Move to the next chain.
				//
				return reject(container);
			}

			//
			//	->	Move to the next chain.
			//
			return resolve(container);

		});

		//
		//	This loop will upload all the individual attachments found
		//	in a email.
		//
		function loop(callback)
		{
			//
			//	1.	Create a simple variable name.
			//
			let file = container.parsed.attachments.pop()

			//
			//	2.	if there is nothing left then we stop the loop.
			//
			if(!file)
			{
				return callback();
			}

			//
			//	2.	Get the file name which also contain the file extension.
			//
			file_name = file.filename

			//
			//	3.	Then save the buffer of the attachment.
			//
			file_body = file.content

			//
			//	4.	Split the S3 Key (path) so we can remove the last element.
			//
			let tmp = container.key.split('/');

			//
			//	5.	Now remove the last element from the array which is the
			//		file name that contains the raw email.
			//
			tmp.pop();

			//
			//	6.	After all this we recombine the array in to a single string
			//		which becomes again the S3 Key minus the file name.
			//
			let path = tmp.join('/');

			//
			//	7.	This variable is used if there are two files of the same
			//		name.
			//
			let cid = "";

			//
			//	8.	If the CID is set then it means that two files have the
			//		same names.
			//
			if(file.cid)
			{
				//
				//	1.	Add the CID in front of the name of the file so they
				//		won't be overwritten.
				//
				cid = file.cid + " - "
			}

			//
			//	9. 	With a clean key, we can create an updated one which contains
			//		the path to for the attachments.
			//
			let key = 	path
						+ "/attachments/"
						+ cid
						+ file_name

			//
			//	10.	Set the query.
			//
			let params = {
				Bucket: container.bucket,
				Key: key,
				Body: file_body
			};

			console.log(params);

			//
			//	->	Execute the query.
			//
			s3.putObject(params, function(error, data) {

				//
				//	1.	Check for internal errors.
				//
				if(error)
				{
					return callback(error);
				}

				//
				//	->	Move to the next chain.
				//
				return loop(callback);

			});
		}

	});
}
