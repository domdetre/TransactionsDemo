const AWS = require('aws-sdk')
const Sequelize = require('sequelize')
const TransactionsModel = require('./model-transactions')

/**
 * The format of the Object of a Transaction.
 * @typedef {Object} Transaction
 * @property {string} party
 * @property {string} counterparty
 * @property {string} datetime In ISO 8601 format.
 * @property {Object} transaction
 * @property {string} transaction.type Type of the transaction, can be D, W, B or S.
 * @property {string|undefined} transaction.value Value of the transaction if the type is either D or W, otherwise undefined.
 * @property {Object} transaction.asset Data about the asset if the type is either B or S, otherwise undefined.
 * @property {Number} transaction.asset.amount
 * @property {string} transaction.asset.name
 * @property {Number} transaction.asset.value The value of one asset, on sum calculations this will be multiplied by the amount.
 */

/**
 * The format of the result of the sum operation
 * @typedef {Object} TransactionsSum
 * @property {Number} balance The calculated balance
 * @property {Object} assets The summed assets in name:amount pairs
 */

/**
 * Reads a file from S3 and splits it by lines to put each line into the next queue.
 * @param {string} filename 
 * @returns {Promise}
 */
const importTransactionsFile = async (filename) => {
  const S3 = new AWS.S3()
  const s3Data = await S3.getObject({
    Bucket: process.env.S3_BUCKET_IMPORTER,
    Key: filename
  }).promise()

  const csvLines = s3Data.Body.toString().split('\n')
  return Promise.all(
    csvLines
      .map(
        (csvLine) => insertIntoQueue(csvLine)
      )
  )
}

/**
 * Converts the csv into Transaction Object then inserts it into dynamodb
 * @param {string} csv 
 * @returns {Promise}
 */
const importTransactionCsv = async (csv) => {
  const data = convertCsvToObject(csv)
  return insertIntoDynamo(data)
}

/**
 * Transforms a line of csv into a Transaction Object
 * @param {string} csvLine 
 * @returns {Transaction}
 */
const convertCsvToObject = (csvLine) => {
  const csvData = csvLine.split(';')
  /** @type {Transaction} */
  const data = {
    party: csvData[1],
    counterparty: csvData[2],
    transaction: {
      type: csvData[3]
    }
  }

  if (csvData[0].match(/\d{13,}/)) {
    data.datetime = (new Date(Number(csvData[0]))).toISOString()
  } else if(csvData[0].match(/\d{1,12}/)) {
    data.datetime = (new Date(Number(csvData[0])*1000)).toISOString()
  } else {
    data.datetime = (new Date(csvData[0])).toISOString()
  }

  switch(data.transaction.type) {
    case 'D':
    case 'W':
      data.transaction.value = Number(csvData[4])
      break
    case 'B':
    case 'S':
      data.transaction.asset = {
        amount: Number(csvData[4]),
        name: csvData[5],
        value: Number(csvData[6]),
      }
      break
  }

  return data
}

/**
 * Inserts a Transaction into the data import queue
 * @param {Transaction} data 
 */
const insertIntoQueue = async (data) => {
  const sqs = new AWS.SQS()
  return sqs.sendMessage({
    QueueUrl: process.env.QUEUE_IMPORT_DATA,
    MessageBody: JSON.stringify(data)
  }).promise()
}

/**
 * Inserts a Transaction into the transactions table
 * @param {Transaction} data 
 */
const insertIntoDynamo = async (data) => {
  const documentClient = new AWS.DynamoDB.DocumentClient()
  return documentClient.put({
    TableName: process.env.DYNAMODB_TABLE_TRANSACTIONS,
    Item: data
  }).promise()
}

/**
 * Sums the provided list of transactions.
 * @param {string} partyType The type of the party. Can be either P or CP.
 * @param {Transaction[]} items The items to be summed
 * @param {TransactionsSum} initialValue An initialValue to start with
 * @returns {TransactionsSum}
 */
const sumTransactions = (partyType, items, initialValue = { balance: 0, assets: {} }) => {
  if (items.length === 0) {
    return []
  }

  return items.reduce(
    (accu, item) => {
      const D = Number(item.transaction.type === 'D' ? 1 : -1)
      const B = Number(item.transaction.type === 'B' ? 1 : -1)
      const P = Number(partyType === 'P' ? 1 : -1)
      switch (item.transaction.type) {
        case 'D':
        case 'W':
          accu.balance += item.transaction.value * D * P
          break
        case 'B':
        case 'S':
          const {amount, value, name} = 
            item.transaction.asset
          accu.balance -= 
            amount * value * B * P
          accu.assets[name] = 
            (accu.assets[name] || 0) + amount * B * P
          break
      }

      return accu
    }, 
    initialValue
  )
}

/**
 * Given an input string of ISO date, this function builds a string that can be used with the query operation to filter by date.
 * The resulted date will be used with a 'less than or equal' operator, so every date that is alphabetically has a lower value will be included.
 * The reason for such a thing is the fact, that '2019' has a lower alphabetical value than '2019-05', but we want the results to be inclusive of the whole year of 2019 when only the year has been specified.
 * If the input date is empty, will return string 'X'
 * Otherwise it will fill each parameter of the datetime with its highest possible value.
 * E.g.: 12 for the month, 23 for the hour, 59 for the minute, etc.
 * @param {string} date 
 */
const buildFilterDate = (date) => {
  if (!date) {
    return 'X'
  }

  const defaults = ['', '-12', '-31', 'T23', ':59', ':59', '.999']
  return (
    [...date.matchAll(
      /(\d+)(-\d+)?(-\d+)?(T\d+)?(:\d+)?(:\d+)?(\.\d+)?/g
    )][0]
      .splice(1)
      .map((item, index) => item || defaults[index])
      .join('')
  )
}

/**
 * Queries the transaction table AND the counterparty index for the party until the given date.
 * It 
 * @param {string} entity The entity whom transactions should be queried.
 * @param {string} date The inclusive until date in ISO format.
 * @returns {array} A 2 index array of DynamoDB Result data. The first element will be result where the entity was the party, the second element will be the result where the entity was the counterparty
 */
const queryTransactions = async (entity, date) => {
  const documentClient = new AWS.DynamoDB.DocumentClient()
  const filterDate = buildFilterDate(date)

  const queryParams = (partyType) => ({
    TableName: process.env.DYNAMODB_TABLE_TRANSACTIONS,
    IndexName: partyType === 'party' ? null : 'counterparty',
    KeyConditionExpression: '#party = :party and #datetime <= :date',
    ExpressionAttributeValues: {
      ':party': entity,
      ':date': filterDate
    },
    ExpressionAttributeNames: {
      '#datetime': 'datetime',
      '#party': partyType
    }
  })

  console.log(queryParams('party'))
  
  return Promise.all([
    documentClient.query(queryParams('party')).promise(),
    documentClient.query(queryParams('counterparty')).promise()
  ])
}

/**
 * Gets the daily position for the given entity.
 * @param {string} entity The entity whom position should be returned
 * @param {string} date The date of the position to get in ISO format.
 * @returns {TransactionsSum}
 */
const getPosition = async (entity, date = '') => {
  const allResults = await queryTransactions(entity, date)
  console.log(allResults)
  const partySum = sumTransactions('P', allResults[0].Items)
  const allSum = sumTransactions('CP', allResults[1].Items, partySum)
  console.log(allSum)
  return allSum
}

const getDatabase = async () => {
  const sequelize = new Sequelize({
    dialect: 'postgresql',
    host: process.env.RDS_HOST,
    database: process.env.RDS_NAME,
    username: process.env.RDS_USER,
    password: process.env.RDS_PASS,
  })

  await sequelize.authenticate()
  TransactionsModel.init(sequelize)
  await TransactionsModel.sync()

  return sequelize
}

const mirrorDynamoDataToSql = async (dynamoImages, sequelize) => {
  console.log('insertIntoRelational: ', dynamoImages.NewImage.transaction.M)
  return sequelize.models.TransactionsModel.create({
    Party: dynamoImages.NewImage.party.S,
    Counterparty: dynamoImages.NewImage.counterparty.S,
    DateTime: dynamoImages.NewImage.datetime.S,
    Transaction: dynamoImages.NewImage.transaction.M,
  })
}

const getTransactions = async ({party, date}) => {
  console.log('getTransactions: ', party, date)
}

const postTransaction = async ({party, date}) => {
  console.log('postTransaction: ', party, date)
}

module.exports = {
  importTransactionsFile,
  convertCsvToObject,
  insertIntoQueue,
  insertIntoDynamo,
  mirrorDynamoDataToSql,
  getTransactions,
  postTransaction,
  getPosition,
  sumTransactions,
  queryTransactions,
  buildFilterDate,
  importTransactionCsv,
  getDatabase
}