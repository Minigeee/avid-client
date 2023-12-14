import React from 'react';
import { readFileSync } from 'fs';

import BlogPost from '@/lib/ui/components/BlogPost';
import { Box, Center, ScrollArea } from '@mantine/core';
import { s3 } from '@/lib/utility/spaces';
import config from '@/config';

////////////////////////////////////////////////////////////
type BlogProps = {
  post: string;
};

////////////////////////////////////////////////////////////
export default function Roadmap({ post }: BlogProps) {
  return (
    <ScrollArea w="100vw" h="100vh">
      <Center>
        <Box
          sx={(theme) => ({
            padding: '3.5rem 3.0rem',
            maxWidth: '100vw',
            backgroundColor: theme.colors.dark[6],
            boxShadow: `0px 0px 15px #00000030`,
          })}
        >
          <BlogPost post={post} width="65ch" />
        </Box>
      </Center>
    </ScrollArea>
  );
}

////////////////////////////////////////////////////////////
export async function getStaticProps() {
  // const post = readFileSync('posts/roadmap.md', { encoding: 'utf-8' });
  const res = await s3.get('posts/roadmap.md');
  const post = await res.Body?.transformToString();

  return {
    props: {
      post,
    } as BlogProps,

    revalidate: config.dev_mode ? 1 : 24 * 60 * 60, // In seconds
  };
}
