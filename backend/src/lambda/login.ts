import {
  GetSecretValueCommand,
  SecretsManager,
} from "@aws-sdk/client-secrets-manager"
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import * as bcrypt from "bcryptjs"
import * as jwt from "jsonwebtoken"

import { UserDb } from "../db/user-db"

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

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const data = parseBody(event.body)
  if (!data) {
    return unauthorizedResponse
  }

  const { username, password } = data

  if (!username || !password) {
    return unauthorizedResponse
  }

  const user = await UserDb.get(username)
  if (!user) {
    return unauthorizedResponse
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return unauthorizedResponse
  }

  const client = new SecretsManager({ region: `${process.env.AWS_REGION}` })
  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: "jwt-secret" }),
  )

  const token = jwt.sign(
    {
      username,
    },
    SecretString!,
    {
      issuer: "test-env-recycler",
      expiresIn: "3h",
    },
  )

  return {
    statusCode: 200,
    body: JSON.stringify({
      token: token,
      username: user.username,
    }),
  }
}
