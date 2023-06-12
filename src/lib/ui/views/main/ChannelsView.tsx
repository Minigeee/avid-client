import { MouseEventHandler, useContext, useState } from 'react';

import {
  ActionIcon,
  Box,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { openConfirmModal } from '@mantine/modals';
import { useForm } from '@mantine/form';

import {
  IconBell,
  IconDotsVertical,
  IconPencil,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';

import ChannelIcon from '@/lib/ui/components/ChannelIcon';

import { DomainWrapper, hasPermission, useApp } from '@/lib/hooks';
import { Channel } from '@/lib/types';

import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';


////////////////////////////////////////////////////////////
type SingleChannelProps = {
  channel: Channel;
  domain: DomainWrapper;
  selected: boolean;
  onClick: () => unknown;

  index: number;
}

////////////////////////////////////////////////////////////
function SingleChannel(props: SingleChannelProps) {
  const form = useForm({
    initialValues: { name: props.channel.name },
  });

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [renaming, setRenaming] = useState<boolean>(false);

  return (
    <Draggable draggableId={props.channel.id} index={props.index}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          sx={(theme) => ({
            display: 'block',
            width: '100%',
            padding: `0.2rem 0.3rem 0.2rem 0.5rem`,
            borderRadius: theme.radius.sm,
            backgroundColor: props.selected || snapshot.isDragging ? theme.colors.dark[5] : theme.colors.dark[6],
            boxShadow: snapshot.isDragging ? '0px 0px 10px #00000033' : undefined,
            transition: 'background-color 0.1s',
            '&:hover': {
              backgroundColor: theme.colors.dark[5],
            },
          })}
          onClick={props.onClick}
          onMouseEnter={() => setShowMenu(true)}
          onMouseLeave={() => setShowMenu(false)}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style, cursor: 'pointer' }}
        >
          <Group spacing='xs' align='center'>
            <ChannelIcon type={props.channel.type} size={17} />

            {!renaming && (
              <Text
                size='sm'
                weight={600}
                sx={{ flexGrow: 1 }}
              >
                {props.channel.name}
              </Text>
            )}
            {renaming && (
              <form style={{ flexGrow: 1 }} onSubmit={form.onSubmit((values) => {
                // Rename channel
                props.domain._mutators.renameChannel(props.channel.id, values.name);
                // Go back to default view
                setRenaming(false);
              })}>
                <TextInput
                  size='xs'
                  mt={0}
                  styles={(theme) => ({
                    wrapper: { marginTop: 0, maxWidth: '20ch' },
                    input: { fontSize: theme.fontSizes.sm, fontWeight: 600 },
                  })}
                  {...form.getInputProps('name')}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => setRenaming(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  autoFocus
                />
              </form>
            )}

            <Menu
              width={180}
              withinPortal
            >
              <Menu.Target>
                <ActionIcon
                  sx={(theme) => ({
                    visibility: showMenu ? 'visible' : 'hidden',
                    '&:hover': {
                      backgroundColor: theme.colors.dark[4]
                    },
                  })}
                  onClick={((e) => {
                    e.stopPropagation();
                  }) as MouseEventHandler<HTMLButtonElement>}
                >
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}>
                <Menu.Label>{props.channel.name.toUpperCase()}</Menu.Label>
                <Menu.Item icon={<IconSettings size={16} />} disabled>Settings</Menu.Item>
                <Menu.Item icon={<IconBell size={16} />} disabled>Notifications</Menu.Item>
                
                {hasPermission(props.domain, props.channel.id, 'can_manage') && (
                  <>
                    <Menu.Item icon={<IconPencil size={16} />} onClick={() => {
                      // Reset form value to channel name
                      form.setFieldValue('name', props.channel.name);
                      setRenaming(true);
                    }}>Rename</Menu.Item>

                    <Menu.Divider />
                    <Menu.Item
                      color='red'
                      icon={<IconTrash size={16} />}
                      onClick={() => {
                        openConfirmModal({
                          title: 'Delete Channel',
                          labels: { cancel: 'Cancel', confirm: 'Delete' },
                          children: (
                            <>Are you sure you want to delete <b>{props.channel.name}</b>?</>
                          ),
                          groupProps: {
                            spacing: 'xs',
                            sx: { marginTop: '0.5rem' },
                          },
                          confirmProps: {
                            color: 'red',
                          },
                          onConfirm: () => {
                            props.domain._mutators.removeChannel(props.channel.id);
                          }
                        })
                      }}
                    >
                      Delete channel
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Box>
      )}
    </Draggable>
  );
}


////////////////////////////////////////////////////////////
type ChannelsViewProps = {
  domain: DomainWrapper;
  channel_id: string;
}

////////////////////////////////////////////////////////////
export default function ChannelsView(props: ChannelsViewProps) {
  const app = useApp();

  return (
    <ScrollArea>
      <DragDropContext onDragEnd={(result) => {
        // Don't allow delete channel by drag
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;

        const copy = props.domain.channels.slice();
        const deleted = copy.splice(result.source.index, 1);
        copy.splice(result.destination.index, 0, deleted[0]);

        // Set new channels
        props.domain._mutators.setChannelOrder(copy);
      }}>
        <Droppable droppableId={props.domain.id}>
          {(provided) => (
            <Stack
              ref={provided.innerRef}
              spacing={0}
              {...provided.droppableProps}
            >
              {props.domain.channels?.map((channel, i) => (
                <SingleChannel
                  key={channel.id}
                  channel={channel}
                  domain={props.domain}
                  selected={props.channel_id === channel.id}
                  onClick={() => {
                    if (props.domain._exists)
                      app._mutators.navigation.setChannel(channel.id);
                  }}

                  index={i}
                />
              ))}

              {provided.placeholder}
            </Stack>
          )}
        </Droppable>
      </DragDropContext>
    </ScrollArea>
  );
}