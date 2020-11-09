const transactions = require('./transactions')

const corsHeaders = {
  "Access-Control-Allow-Headers" : "*",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
}

module.exports = {
  getPosition: async (event) => {
    console.log(event)
    const { entity, date } = event.queryStringParameters
    if (!entity || !date) {
      return {
        headers: corsHeaders,
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Wrong params'
        })
      }
    }

    const sum = await transactions.getPosition(entity, date)
    return {
      headers: corsHeaders,
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        data: sum
      })
    }
  },

  getTransactions: async (event) => {
    console.log(event)
  },

  postTransaction: async (event) => {
    console.log(event)
  },

  importTransactionsFile: async (event) => {
    console.log(event)

    return Promise.all(
      event.Records
        .map(
          (record) => JSON.parse(record.body)
        )
        .map(
          (message) => Promise.all(
            message.Records
              .map(
                (record) => transactions.importTransactionsFile(record.s3.object.key)
              )
          )
        )
    )
  },

  importTransactionsData: async (event) => {
    console.log(event)

    return Promise.all(
      event.Records
        .map(
          (record) => JSON.parse(record.body)
        )
        .map(
          (csv) => transactions.importTransactionCsv(csv)
        )
    )
  },

  mirrorTransaction: async (event) => {
    console.log(event)

    const database = await transactions.getDatabase()

    return Promise.all(
      event.Records
        .map(
          (record) => transactions.mirrorDynamoDataToSql(record.dynamodb, database)
        )
    )
  }
}