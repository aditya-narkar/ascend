import ResetPasswordClient from './ResetPasswordClient'

type Props = {
  searchParams: Promise<{ code?: string }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams
  return <ResetPasswordClient code={params.code} />
}
