const AWSMock = require('jest-aws-sdk-mock')

const transactions = require('../../source/nodejs/transactions')

describe('UNIT convertCsvToObject', () => {
  describe.each([
    [
      '1572723958024;person-a;person-b;D;200',
      {
        datetime: '2019-11-02T19:45:58.024Z',
        party: 'person-a',
        counterparty: 'person-b',
        transaction: {
          type: 'D',
          value: 200,
        },
      }
    ],
    [
      '1572807838935;person-a;person-b;W;200',
      {
        datetime: '2019-11-03T19:03:58.935Z',
        party: 'person-a',
        counterparty: 'person-b',
        transaction: {
          type: 'W',
          value: 200,
        },
      }
    ],
    [
      '1572815038592;person-a;person-b;B;3;APPL;100',
      {
        datetime: '2019-11-03T21:03:58.592Z',
        party: 'person-a',
        counterparty: 'person-b',
        transaction: {
          type: 'B',
          asset: {
            amount: 3,
            name: 'APPL',
            value: 100
          }
        },
      }
    ],
    [
      '1572860758012;person-a;person-b;S;2;APPL;120',
      {
        datetime: '2019-11-04T09:45:58.012Z',
        party: 'person-a',
        counterparty: 'person-b',
        transaction: {
          type: 'S',
          asset: {
            amount: 2,
            name: 'APPL',
            value: 120
          }
        },
      }
    ]
  ])('GIVEN I have the following csv line: "%s"', (csvLine, expectedData) => {
    let actualData
    beforeAll(() => {
      actualData = transactions.convertCsvToObject(csvLine)
    })

    test('THEN it should process the line correctly', () => {
      expect(actualData).toEqual(expectedData)
    })
  })
})

describe('UNIT sumTransactions', () => {
  describe.each([
    ['P',  'D', 200, { balance: 200, assets: {} }],
    ['CP', 'D', 200, { balance: -200, assets: {} }],
    ['P',  'W', 200, { balance: -200, assets: {} }],
    ['CP', 'W', 200, { balance: 200, assets: {} }],
  ])('GIVEN party is "%s" and transaction.type is "%s" and transaction.value is "%d"', (
    party, type, value, expectedResult
  ) => {
    let actualResult
    beforeAll(() => {
      actualResult = transactions.sumTransactions(party, [{
        transaction: { type, value }
      }])
    })

    test('THEN should be calculated correctly', () => {
      expect(actualResult).toStrictEqual(expectedResult)
    })
  })

  describe.each([
    ['P',  'B', 3, 'APPL', 100, { balance: -300, assets: { APPL: 3 } }],
    ['CP', 'B', 3, 'APPL', 100, { balance: 300, assets: { APPL: -3 } }],
    ['P',  'S', 2, 'APPL', 120, { balance: 240, assets: { APPL: -2 } }],
    ['CP', 'S', 2, 'APPL', 120, { balance: -240, assets: { APPL: 2 } }],
  ])('GIVEN party is "%s" and transaction.type is "%s" and transaction.asset.amount is "%d" and transaction.asset.name is "%s" and transaction.asset.value is "%d"', (
    party, type, amount, name, value, expectedResult
  ) => {
    let actualResult
    beforeAll(() => {
      actualResult = transactions.sumTransactions(party, [{
        transaction: { type, asset: { amount, name, value } }
      }])
    })

    test('THEN should be calculated correctly', () => {
      expect(actualResult).toStrictEqual(expectedResult)
    })
  })

  describe('GIVEN I have an initialValue set for type "D"', () => {
    let actualResult
    beforeAll(() => {
      actualResult = transactions.sumTransactions('P', [{
        transaction: { type: 'D', value: 200 }
      }], {
        balance: 140,
        assets: {}
      })
    })

    test('THEN it should include the initialValue in the resulted sum', () => {
      expect(actualResult).toEqual({
        balance: 340,
        assets: {}
      })
    })
  })

  describe('GIVEN I have an initialValue set for type "B"', () => {
    let actualResult
    beforeAll(() => {
      actualResult = transactions.sumTransactions('P', [{
        transaction: { type: 'B', asset: { amount: 2, name: 'APPL', value: 120 } }
      }], {
        balance: 150,
        assets: {}
      })
    })

    test('THEN it should include the initialValue in the resulted sum', () => {
      expect(actualResult).toEqual({
        balance: -90,
        assets: {
          APPL: 2
        }
      })
    })
  })
})

describe('UNIT buildFilterDate', () => {
  describe.each([
    ['', 'X'],
    ['2019', '2019-12-31T23:59:59.999'],
    ['2019-05', '2019-05-31T23:59:59.999'],
    ['2019-05-14', '2019-05-14T23:59:59.999'],
    ['2019-05-14T11', '2019-05-14T11:59:59.999'],
    ['2019-05-14T11:23', '2019-05-14T11:23:59.999'],
    ['2019-05-14T11:23:15', '2019-05-14T11:23:15.999'],
    ['2019-05-14T11:23:15.456', '2019-05-14T11:23:15.456'],
  ])('GIVEN the date is set to "%s"', (date, expected) => {
    let actual
    beforeAll(() => {
      actual = transactions.buildFilterDate(date)
    })

    test(`THEN it should return "${expected}"`, () => {
      expect(actual).toBe(expected)
    })
  })
})

describe('UNIT queryTransactions', () => {
  describe('GIVEN party is set to "party" and date set to "2019-05-14T11:23:15.456"', () => {
    process.env.DYNAMODB_TABLE_TRANSACTIONS = 'test-table'

    const party = 'party'
    const date = '2019-05-14T11:23:15.456'

    const queryResult = 'result'
    const mockQuery = jest.fn((params, callback) => {
      callback(null, queryResult)
    })

    let actual
    beforeAll(async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'query', mockQuery)

      actual = await transactions.queryTransactions(party, date)
    })
    afterAll(() => {
      AWSMock.restore('DynamoDB.DocumentClient')
    })

    test('THEN should return an array of 2 results', () => {
      expect(actual).toStrictEqual([queryResult, queryResult])
    })

    test('THEN the first query should target the table and filter by party and date', () => {
      expect(mockQuery.mock.calls[0][0]).toEqual(
        {
          TableName: process.env.DYNAMODB_TABLE_TRANSACTIONS,
          IndexName: null,
          KeyConditionExpression: '#party = :party and #datetime <= :date',
          ExpressionAttributeValues: {
            ':party': party,
            ':date': date
          },
          ExpressionAttributeNames: {
            '#datetime': 'datetime',
            '#party': 'party'
          }
        }
      )
    })

    test('THEN the second query should target the index "counterparty" and filter by counterparty and date', () => {
      expect(mockQuery.mock.calls[1][0]).toEqual(
        {
          TableName: process.env.DYNAMODB_TABLE_TRANSACTIONS,
          IndexName: 'counterparty',
          KeyConditionExpression: '#party = :party and #datetime <= :date',
          ExpressionAttributeValues: {
            ':party': party,
            ':date': date
          },
          ExpressionAttributeNames: {
            '#datetime': 'datetime',
            '#party': 'counterparty'
          }
        }
      )
    })
  })
})

describe('UNIT importTransactionsFile', () => {
  describe('GIVEN filename is set to "test.csv" with 2 lines', () => {
    process.env.S3_BUCKET_IMPORTER = 'test-bucket'

    const filename = 'test.csv'
    
    const csvLines = ['line1', 'line2']
    const s3Result = csvLines.join('\n')
    const mockGetObject = jest.fn((params, callback) => {
      callback(null, s3Result)
    })

    let spyconvertCsvToObject, spyInsertIntoQueue
    let actual
    beforeAll(() => {
      AWSMock.mock('S3', 'getObject', mockGetObject)

      actual = transactions.importTransactionsFile(filename)
    })
    afterAll(() => {
      AWSMock.restore('S3')
      jest.restoreAllMocks()
    })

    test('THEN S3 getObject should have been called with the filename', () => {
      expect(mockGetObject.mock.calls[0][0]).toEqual({
        Bucket: process.env.S3_BUCKET_IMPORTER,
        Key: filename
      })
    })

    test('THEN it should return a promise', () => {
      expect(actual).toBeInstanceOf(Promise)
    })
  })
})

describe('UNIT insertIntoQueue', () => {
  describe('GIVEN', () => {
    process.env.QUEUE_IMPORT_DATA = 'test-queue'

    const data = { test: 'test' }

    const mockSendMessage = jest.fn((params, callback) => {
      callback(null, true)
    })

    let actual
    beforeAll(() => {
      AWSMock.mock('SQS', 'sendMessage', mockSendMessage)

      actual = transactions.insertIntoQueue(data)
    })
    afterAll(() => {
      AWSMock.restore('SQS')
    })

    test('THEN it should call sqs.sendMessage with the data stringified', () => {
      expect(mockSendMessage.mock.calls[0][0]).toEqual({
        QueueUrl: process.env.QUEUE_IMPORT_DATA,
        MessageBody: JSON.stringify(data)
      })
    })

    test('THEN it should return a promise', () => {
      expect(actual).toBeInstanceOf(Promise)
    })
  })
})

describe('UNIT insertIntoDynamo', () => {
  describe('GIVEN', () => {
    process.env.DYNAMODB_TABLE_TRANSACTIONS = 'test-table'

    const data = { test: 'test' }

    const mockPut = jest.fn((params, callback) => {
      callback(null, true)
    })

    let actual
    beforeAll(() => {
      AWSMock.mock('DynamoDB.DocumentClient', 'put', mockPut)

      actual = transactions.insertIntoDynamo(data)
    })
    afterAll(() => {
      AWSMock.restore('DynamoDB.DocumentClient')
    })

    test('THEN it should call DynamoDB.DocumentClient.put with the data as Item', () => {
      expect(mockPut.mock.calls[0][0]).toEqual({
        TableName: process.env.DYNAMODB_TABLE_TRANSACTIONS,
        Item: data
      })
    })

    test('THEN it should return a promise', () => {
      expect(actual).toBeInstanceOf(Promise)
    })
  })
})

describe('UNIT getPosition', () => {
  describe.each([
    ['person-a', '', { balance: 400, assets: {} }]
  ])('GIVEN entity is set to "%s" and date is set to "%s"', (
    entity, date, expected
  ) => {
    process.env.DYNAMODB_TABLE_TRANSACTIONS = 'test-table'

    const queryResult = {
      party: {
        Items: [{
          transaction: {
            type: 'D',
            value: 200,
          },
        }]
      },
      counterparty: {
        Items: [{
          transaction: {
            type: 'W',
            value: 200,
          },
        }]
      }
    }
    const mockQuery = jest.fn((params, callback) => {
      callback(
        null, 

        params.IndexName === 'counterparty' ? 
          queryResult.counterparty :
          queryResult.party
      )
    })

    let actual
    beforeAll(async () => {
      AWSMock.mock('DynamoDB.DocumentClient', 'query', mockQuery)

      actual = await transactions.getPosition(entity, date)
    })
    afterAll(() => {
      AWSMock.restore('DynamoDB.DocumentClient')
    })

    test('THEN should return a correct sum', () => {
      expect(actual).toEqual(expected)
    })
  })
})
