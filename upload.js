const AWS = require("aws-sdk");
const parseMultipart = require("parse-multipart");

const BUCKET = process.env.BUCKET;
const TABLE = process.env.TABLE_NAME;

const s3 = new AWS.S3();
const db = new AWS.DynamoDB.DocumentClient();

module.exports.handle = async (event) => {
  try {
    const { type, filename, data } = extractFile(event);
    let resultData = {};

    if (isMimeTypeNotAccepted(type)) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Mimetype is not accepted.",
        }),
      };
    } else {
      await s3
        .putObject({
          Bucket: BUCKET,
          Key: filename,
          Body: data,
        })
        .promise()
        .then(
          async (res) => {
            if (type === "image/png") {
              await db
                .put({
                  TableName: TABLE,
                  Item: {
                    image_url: `https://${BUCKET}.s3.amazonaws.com/${filename}`,
                  },
                })
                .promise()
                .then(
                  (res) => {
                    console.log("RESULT: " + JSON.stringify(res));
                    resultData = {
                      statusCode: 200,
                      body: JSON.stringify({
                        message:
                          "Image file is uploaded to s3 and url is upload to dynamoDb",
                        link: `https://${BUCKET}.s3.amazonaws.com/${filename}`,
                      }),
                    };
                  },
                  (err) => {
                    console.log("ERROR[01]: " + JSON.stringify(err));
                    resultData = {
                      statusCode: 500,
                      body: JSON.stringify({
                        message_db: err.stack,
                      }),
                    };
                  }
                );
            } else {
              resultData = {
                statusCode: 200,
                body: JSON.stringify({
                  message: "File is uploaded to S3 storage",
                  link: `https://${BUCKET}.s3.amazonaws.com/${filename}`,
                }),
              };
            }
          },
          (err) => {
            console.log("ERROR[02]: " + JSON.stringify(err));
            resultData = {
              statusCode: 500,
              body: JSON.stringify({
                message_db: err.stack,
              }),
            };
          }
        );
    }

    return resultData;
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.stack }),
    };
  }
};

const extractFile = (event) => {
  const boundary = parseMultipart.getBoundary(event.headers["Content-Type"]);
  const parts = parseMultipart.Parse(
    Buffer.from(event.body, "base64"),
    boundary
  );
  const [{ filename, data, type }] = parts;

  return {
    type,
    filename,
    data,
  };
};

const isMimeTypeNotAccepted = (type) => {
  let accepted_mime = ["image/png", "application/pdf", "text/csv"];
  return !accepted_mime.find((e) => e == type);
};
