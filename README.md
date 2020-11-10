# Transactions demo

  A minimal service with importing feature and basic error handling but fully managed by AWS

## Caveats

  - The service cannot handle too big files due to the limitations of Lambda

## Deployment

  Deployment is fully handeld by serverless, here are some ways to deploy:

  - from terminal  
    run `npx sls deploy` or `npx sls deploy --stage "YOURSTAGE"`

  - from terminal, but only the frontend  
    run `npx sls s3deploy` or `npx sls s3deploy --stage "YOURSTAGE"`

  - from docker  
    run `npm run deploy` or `npm run deploy -- --stage "YOURSTAGE"`  
    If you go with this options make sure you have a `.env` file with the aws keys for deployment: `AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

## Testing

  `npm test` will run the tests in a docker container matching the target node version

## Frontend

  The frontend is very minimal and does not use cognito for the S3 uploads. Therefore there are 2 text input one for the aws key and another for the secret. The credentials need list and upload access to the importer bucket of this service.