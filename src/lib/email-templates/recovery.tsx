import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  token,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click
          the button below to choose a new password.
        </Text>
        {token ? (
          <>
            <Text style={text}>Your password reset code is:</Text>
            <Text style={code}>{token}</Text>
            <Text style={text}>Enter it on Kivora within 1 hour. Or use the button below.</Text>
          </>
        ) : null}
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#F97316',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #F97316',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const code = { fontSize: '28px', fontWeight: 'bold' as const, letterSpacing: '6px', color: '#000000', margin: '0 0 20px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #F97316 !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: #F97316 !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: #F97316 !important; color: #ffffff !important; }
`
