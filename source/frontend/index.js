const url = 'https://1ry808afv8.execute-api.eu-central-1.amazonaws.com/test12/'

const importerBucket = "transactions-demo-test12-importer-bucket";
const bucketRegion = "eu-central-1";

let s3
let config

const awsConfig = () => {
  AWS.config.update({
    region: config.region,
    accessKeyId: $('#key').val(),
    secretAccessKey : $('#secret').val()
  })
}

/**
 * Init
 */
$(document).ready(() => {
  $.getJSON(`config.json`)
    .done((data) => config = data)
})

/**
 * List CSVs
 */
$(document).ready(() => {
  $('#list-csvs').click(() => {
    $('#list-csvs').attr('disabled', true)

    awsConfig()
    new AWS.S3().listObjectsV2({
      Bucket: config.importerBucket
    })
      .promise()
      .then(list => $('#csvs').val(JSON.stringify(list, null, 2)))
      .catch((error) => console.error(error) && $('#list-csvs').val(error.message))
      .finally(() => $('#list-csvs').removeAttr('disabled'))
  })
})

/**
 * Upload CSV
 */
$(document).ready(() => {
  $('#upload-csv').click(() => {
    const files = document.getElementById("csv-file").files
    if (!files.length) {
      return
    }

    const file = files[0]

    $('#upload-csv').attr('disabled', true)

    awsConfig()
    new AWS.S3.ManagedUpload({
      params: {
        Bucket: config.importerBucket,
        Key: file.name,
        Body: file,
      }
    })
      .promise()
      .then(() => $('#result-upload-csv').val('File uploaded successfully'))
      .catch((error) => console.error(error) && $('#result-upload-csv').val(error.message))
      .finally(() => $('#upload-csv').removeAttr('disabled'))
  })
})

/**
 * Get Postion
 */
$(document).ready(() => {
  $('#get-positions').click(() => {
    $('#get-positions').attr('disabled', true)

    $.getJSON(
      `${config.restUrl}/position`,
      {
        entity: $('#entity').val(),
        date: $('#date').val(),
      }
    )
      .done((results) => $('#positions').val(JSON.stringify(results.data, null, 2)))
      .fail((jqxhr, textStatus, error) => console.error(error, textStatus, jqxhr) && $('positions').val(error))
      .always(() => $('#get-positions').removeAttr('disabled'))
  })
})