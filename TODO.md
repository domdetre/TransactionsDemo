- middy
- E2E tests
- Cognito for federated login
- Rotating secret
- VPC for RDS for improved security
- mirroring into sql can be done in batches with one insert and multiple values

- Improve handling of csv files:
  Currently lambda has 15 minute and 3 gig ram limitation. As a result it cannot read big files in one go. There are different ideas to solve it:
  - retrieve file by small segments sequentially or concurrently  
    This allows to overcome the memory limitations, but has a time limit. Although handling the partial data caused by the splitting can be fiddly.
  - retrieve file by small segments and put it in another queue for parallel processing
    This both allows to overcome the memory and time limit, however requires another queue and lambda solution to be present. However has the same problem as the previous solution.
  - Use ElasticBeanstalk Worker tier
    EB worker is fully managed and can run nodejs. This allows to overcome both the memroy and time limitation, since here both are virtually infinite. Although this is more costly, since EB has to run at least 1 instance all the time and with a huge instance it could result a pricey minimal running cost, even when not processing a thing.