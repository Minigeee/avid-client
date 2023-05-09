import Link from 'next/link';
import { useRouter } from 'next/router';

import {
  Button,
} from '@mantine/core';


export default function Login() {
  const router = useRouter();

  return (
    <div>
      <Button
        component='a'
        href={`http://localhost:3000/api/login?provider=google${router.query.redirect ? `&redirect=${encodeURIComponent(router.query.redirect as string)}` : ''}`}
      >
        Login
      </Button>
    </div>
  )
}
