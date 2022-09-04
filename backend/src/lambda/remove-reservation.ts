import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  console.log("event", event)

  return {
    body: JSON.stringify({ message: "Successful lambda invocation" }),
    statusCode: 200,
  }
}
