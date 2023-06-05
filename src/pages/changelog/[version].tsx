import React from 'react'
import { readFileSync } from 'fs';

import BlogPost from '@/lib/ui/components/BlogPost';
import { Box, Center, ScrollArea } from '@mantine/core';
import { s3 } from '@/lib/utility/spaces';
import config from '@/config';
import { GetStaticProps, NextPageContext } from 'next';


////////////////////////////////////////////////////////////
type BlogProps = {
  post: string;
};

////////////////////////////////////////////////////////////
export default function Roadmap({ post }: BlogProps) {
  return (
    <ScrollArea w='100vw' h='100vh'>
      <Center>
        <Box sx={(theme) => ({
          padding: '3.5rem 3.0rem',
          maxWidth: '100vw',
          backgroundColor: theme.colors.dark[6],
          boxShadow: `0px 0px 15px #00000030`,
        })}>
          <BlogPost post={post} width='65ch' />
        </Box>
      </Center>
    </ScrollArea>
  );
}

////////////////////////////////////////////////////////////
export const getStaticProps: GetStaticProps<BlogProps> = async (ctx) => {
  const version = 'v' + (ctx.params?.version as string)?.replaceAll('-', '.');

  try {
    const res = await s3.get(`posts/changelogs/${version}.md`);
    const post = await res.Body?.transformToString();
  
    return {
      props: {
        post,
      } as BlogProps,
  
      revalidate: config.dev_mode ? 1 : 24 * 60 * 60, // In seconds
    };
  }
  catch (err) {
    return { notFound: true };
  }
}

////////////////////////////////////////////////////////////
export function getStaticPaths() {
  return {
    paths: [
      { params: { version: '0-1' } },
    ],
    fallback: false,
  };
}