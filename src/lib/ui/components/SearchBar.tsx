import {} from 'react';

import { CloseButton, TextInput, TextInputProps } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

////////////////////////////////////////////////////////////
export type SearchBarProps = Omit<TextInputProps, 'onChange'> & {
  /** The function that gets called when text changes */
  onChange: (value: string) => void;
};

////////////////////////////////////////////////////////////
export default function SearchBar(props: SearchBarProps) {
  return (
    <TextInput
      placeholder="Search"
      icon={<IconSearch size={18} />}
      {...props}
      onChange={(e) => props.onChange(e.currentTarget.value)}
      rightSection={
        props.value && (props.value as string).length > 0 ? (
          <CloseButton onClick={() => props.onChange('')} />
        ) : undefined
      }
    />
  );
}
