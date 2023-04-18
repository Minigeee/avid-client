import Link from 'next/link';

import {
  Button,
} from '@mantine/core';


export default function Login() {
  return (
    <div>
      <Button component="a" href='http://localhost:3000/api/login?provider=google'>Login</Button>
    </div>
  )
}
