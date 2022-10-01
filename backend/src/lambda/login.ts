import {
  AuthFlowType,
  CognitoIdentityProvider,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"

interface LoginData {
  username: string
  password: string
}

const parseBody = (body: string | undefined): LoginData | undefined => {
  if (!body) {
    return undefined
  }
  try {
    return JSON.parse(body) as LoginData
  } catch (e) {
    return undefined
  }
}

const unauthorizedResponse = {
  statusCode: 401,
  body: JSON.stringify({
    message: "Unauthorized",
  }),
}

const cognito = new CognitoIdentityProvider({ region: process.env.AWS_REGION })

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const data = parseBody(event.body)
  if (!data) {
    console.log("Failed to parse request body")
    return unauthorizedResponse
  }

  const { username, password } = data

  if (!username || !password) {
    console.log("Username or password not provided")
    return unauthorizedResponse
  }

  try {
    const { AuthenticationResult } = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
        ClientId: process.env.USER_POOL_CLIENT_ID,
      }),
    )

    console.log("Login succeeded")

    return {
      statusCode: 200,
      body: JSON.stringify({
        token: AuthenticationResult?.AccessToken,
      }),
    }
  } catch (e) {
    console.log("Login failed")
    return unauthorizedResponse
  }
}
