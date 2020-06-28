import AWS from 'aws-sdk';
import commonMiddleware from '../lib/commonMiddleware';
import createError from 'http-errors';
import { getAuctionById } from './getAuction';
import validator from '@middy/validator';
import placeBidSchema from '../lib/schemes/placeBidSchema';

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function placeBid(event, context) {
  const { id } = event.pathParameters;
  const { email } = event.requestContext.authorizer;
  const { amount } = event.body;

  const auction = await getAuctionById(id);

  // bid id validation
  if (email === auction.seller) {
    throw new createError.Forbidden(`You cannot bid on your own auctions!`)
  }

  // bid id validation
  if (email === auction.highestBid.bidder) {
    throw new createError.Forbidden(`You are already the highest bidder`)
  }

  // status validation
  if (auction.status !== 'OPEN') {
    throw new createError.Forbidden(`Your cannot bid on closed auctions!`)
  }

  // amount validation
  if (amount <= auction.highestBid.amount) {
    throw new createError.Forbidden(`Your bid must higher then ${auction.highestBid.amount}!`)
  }

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
    ExpressionAttributeValues: {
      ':amount': amount,
      ':bidder': email,
    },
    ReturnValues: 'ALL_NEW',
  };

  let updatedAuction;

  try {
    const result = await dynamodb.update(params).promise();
    updatedAuction = result.Attributes;
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

export const handler = commonMiddleware(placeBid)
  .use(validator({ inputSchema: placeBidSchema }));
