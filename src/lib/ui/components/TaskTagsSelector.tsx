import { forwardRef } from 'react';

import {
  Box,
  CloseButton,
  Group,
  MultiSelect,
  MultiSelectProps,
  MultiSelectValueProps,
  Text,
  UnstyledButton,
} from '@mantine/core';

////////////////////////////////////////////////////////////
interface TagItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: number;
  label: string;
  color: string;
}

////////////////////////////////////////////////////////////
const TagSelectItem = forwardRef<HTMLDivElement, TagItemProps>(
  ({ label, color, ...others }: TagItemProps, ref) => (
    <div ref={ref} {...others}>
      <Box
        sx={{
          width: 'fit-content',
          padding: '1px 11px 2px 11px',
          background: color,
          borderRadius: 15,
        }}
      >
        <Text size='xs' weight={500}>
          {label}
        </Text>
      </Box>
    </div>
  ),
);
TagSelectItem.displayName = 'TagSelectItem';

////////////////////////////////////////////////////////////
function TagSelectValue({
  value,
  label,
  color,
  onRemove,
  ...others
}: MultiSelectValueProps & { value: string; color: string }) {
  return (
    <div {...others}>
      <UnstyledButton
        sx={{
          padding: '1px 5px 2px 11px',
          background: color,
          borderRadius: 15,
        }}
      >
        <Group spacing={2} align='end'>
          <Text size='xs' weight={500}>
            {label}
          </Text>
          <CloseButton
            size={16}
            iconSize={12.5}
            variant='transparent'
            tabIndex={-1}
            onMouseDown={onRemove}
          />
        </Group>
      </UnstyledButton>
    </div>
  );
}

export default function TaskTagsSelector(props: MultiSelectProps) {
  return (
    <>
      <MultiSelect
        searchable
        clearable
        itemComponent={TagSelectItem}
        valueComponent={TagSelectValue}
        styles={{
          wrapper: { width: '40ch' },
          value: { margin: '3px 5px 3px 2px' },
        }}
        {...props}
      />
    </>
  );
}
