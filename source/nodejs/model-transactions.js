const Sequelize = require('sequelize')

class Transactions extends Sequelize.Model {
  /**
   * Wraps Model.init with the schema and a sequelize instance.
   * @param {Sequelize} sequelize An instance of sequelize
   */
  static init (sequelize) {
    super.init(
      {
        Party: {
          type: Sequelize.DataTypes.STRING,
        },
        Counterparty: {
          type: Sequelize.DataTypes.STRING
        },
        DateTime: {
          type: Sequelize.DataTypes.DATE
        },
        Transaction: {
          type: Sequelize.DataTypes.JSONB
        },
      },
      { sequelize }
    )
  }
}

module.exports = Transactions