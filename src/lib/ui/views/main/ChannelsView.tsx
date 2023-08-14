import { MouseEventHandler, useContext, useState } from 'react';

import {
  ActionIcon,
  Box,
  Flex,
  Group,
  Indicator,
  Menu,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';

import {
  IconBell,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';

import { openChannelGroupSettings, openChannelSettings, openCreateChannel } from '@/lib/ui/modals';
import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';

import { DomainWrapper, hasPermission, useApp } from '@/lib/hooks';
import { Channel, ChannelGroup } from '@/lib/types';

import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';


////////////////////////////////////////////////////////////
type SingleChannelProps = {
  channel: Channel;
  domain: DomainWrapper;
  group_id: string;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;

  index: number;
}

////////////////////////////////////////////////////////////
function SingleChannel(props: SingleChannelProps) {
  const app = useApp();
  const { open: openConfirmModal } = useConfirmModal();

  const form = useForm({
    initialValues: { name: props.channel.name },
  });

  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [renaming, setRenaming] = useState<boolean>(false);

  const canEdit = hasPermission(props.domain, props.channel.id, 'can_manage_resources') || hasPermission(props.domain, props.channel.id, 'can_manage');

  return (
    <Draggable draggableId={props.channel.id} index={props.index} isDragDisabled={!canEdit}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          sx={(theme) => ({
            display: 'block',
            width: '100%',
            padding: `0.2rem 0.3rem 0.2rem 0.5rem`,
            borderRadius: theme.radius.sm,
            backgroundColor: props.selected || snapshot.isDragging ? theme.colors.dark[5] : theme.colors.dark[6],
            color: theme.colors.dark[app.seen[props.domain.id]?.[props.channel.id] && !props.selected ? 2 : 0],
            boxShadow: snapshot.isDragging ? '0px 0px 10px #00000033' : undefined,
            transition: 'background-color 0.1s, color 0.1s',
            '&:hover': {
              backgroundColor: theme.colors.dark[5],
              '.dropdown': { visibility: 'visible' },
              '.ping-indicator': { display: 'none' },
            },
            '&:focus-within': {
              '.dropdown': { visibility: 'visible' },
              '.ping-indicator': { display: 'none' },
            },
          })}
          onClick={props.onClick}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style, cursor: 'pointer' }}
        >
          <Flex gap={8} align='center'>
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
                  onKeyDown={(e) => {
                    if (e.key === 'Escape')
                      e.currentTarget.blur();
                  }}
                  autoFocus
                />
              </form>
            )}

            <Menu
              width={180}
              withinPortal
              onClose={() => setShowMenu(false)}
            >
              <Menu.Target>
                <ActionIcon
                  className='dropdown'
                  sx={(theme) => ({
                    visibility: showMenu ? 'visible' : 'hidden',
                    '&:hover': {
                      backgroundColor: theme.colors.dark[4]
                    },
                  })}
                  onClick={((e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
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
                {canEdit && (
                  <Menu.Item
                    icon={<IconSettings size={16} />}
                    disabled={props.channel.type !== 'board'}
                    onClick={() => openChannelSettings({
                      domain_id: props.domain.id,
                      channel: props.channel,
                    })}
                  >
                    Settings
                  </Menu.Item>
                )}

                <Menu.Item icon={<IconBell size={16} />} disabled>Notifications</Menu.Item>

                {canEdit && (
                  <Menu.Item icon={<IconPencil size={16} />} onClick={() => {
                    // Reset form value to channel name
                    form.setFieldValue('name', props.channel.name);
                    setRenaming(true);
                  }}>Rename</Menu.Item>
                )}

                {hasPermission(props.domain, props.channel.id, 'can_manage_resources') && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      color='red'
                      icon={<IconTrash size={16} />}
                      onClick={() => {
                        openConfirmModal({
                          title: 'Delete Channel',
                          content: (<Text>Are you sure you want to delete <b>{props.channel.name}</b>?</Text>),
                          confirmLabel: 'Delete',
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

            {app.pings?.[props.channel.id] !== undefined && app.pings[props.channel.id] > 0 && (
              <Text
                className='ping-indicator'
                size='xs'
                weight={600}
                inline
                sx={(theme) => ({
                  display: showMenu ? 'none' : undefined,
                  padding: '0.15rem 0.3rem 0.25rem 0.3rem',
                  marginRight: '0.4rem',
                  backgroundColor: theme.colors.red[5],
                  color: theme.colors.dark[0],
                  borderRadius: '1.0rem',
                })}>
                {app.pings?.[props.channel.id]}
              </Text>
            )}
          </Flex>
        </Box>
      )}
    </Draggable>
  );
}


////////////////////////////////////////////////////////////
type ChannelGroupProps = {
  group: ChannelGroup;
  domain: DomainWrapper;
  selected: string;

  index: number;
};

////////////////////////////////////////////////////////////
function ChannelGroupComponent(props: ChannelGroupProps) {
  const app = useApp();
  const { open: openConfirmModal } = useConfirmModal();
  
  const form = useForm({
    initialValues: { name: props.group.name },
  });

  const [opened, setOpened] = useState<boolean>(true);
  const [renaming, setRenaming] = useState<boolean>(false);

  // TODO : fix/apply inherited permissions

  return (
    <Draggable draggableId={props.group.id} index={props.index} isDragDisabled={!hasPermission(props.domain, props.domain.id, 'can_manage')}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          mb={16}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style, cursor: 'pointer' }}
        >
          <Group
            spacing={2}
            mb={1}
            sx={(theme) => ({
              width: '100%',
              padding: `0.2rem 0.3rem 0.2rem 0.5rem`,
              borderRadius: theme.radius.sm,
              backgroundColor: snapshot.isDragging ? theme.colors.dark[5] : theme.colors.dark[6],
              boxShadow: snapshot.isDragging ? '0px 0px 10px #00000033' : undefined,
              transition: 'background-color 0.1s',
              '&:hover': {
                backgroundColor: theme.colors.dark[5],
              },
              '.tabler-icon': {
                color: theme.colors.dark[1],
              },
            })}
            onClick={() => setOpened(!opened)}
          >
            {!opened && (<IconChevronRight size={16} />)}
            {opened && (<IconChevronDown size={16} />)}

            {!renaming && (
              <Text
                size='xs'
                weight={600}
                ml={4}
                sx={(theme) => ({ color: theme.colors.dark[1] })}
              >
                {props.group.name}
              </Text>
            )}
            {renaming && (
              <form style={{ flexGrow: 1 }} onSubmit={form.onSubmit((values) => {
                // Rename channel
                props.domain._mutators.renameGroup(props.group.id, values.name);
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
                  onKeyDown={(e) => {
                    if (e.key === 'Escape')
                      e.currentTarget.blur();
                  }}
                  autoFocus
                />
              </form>
            )}

            <div style={{ flexGrow: 1 }} />

            {hasPermission(props.domain, props.group.id, 'can_manage_resources') && (
              <ActionButton
                tooltip='Create Channel'
                size='sm'
                onClick={(e) => {
                  e.stopPropagation();
                  openCreateChannel({ domain: props.domain, group_id: props.group.id });
                }}
              >
                <IconPlus size={16} />
              </ActionButton>
            )}

            {(hasPermission(props.domain, props.group.id, 'can_manage') || hasPermission(props.domain, props.group.id, 'can_delete_group')) && (
              <Menu
                width={180}
                withinPortal
              >
                <Menu.Target>
                  <ActionIcon
                    size='sm'
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    sx={(theme) => ({ '&:hover': { backgroundColor: theme.colors.dark[4] } })}
                  >
                    <IconDotsVertical size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown
                  onClick={(e) => {
                    e.stopPropagation();
                  }}>
                  <Menu.Label>{props.group.name.toUpperCase()}</Menu.Label>
                  <Menu.Item
                    icon={<IconSettings size={16} />}
                    onClick={() => {
                      openChannelGroupSettings({ domain_id: props.domain.id, group: props.group });
                    }}
                  >
                    Settings
                  </Menu.Item>

                  {hasPermission(props.domain, props.group.id, 'can_manage') && (
                    <Menu.Item icon={<IconPencil size={16} />} onClick={() => {
                      // Reset form value to channel name
                      form.setFieldValue('name', props.group.name);
                      setRenaming(true);
                    }}>Rename</Menu.Item>
                  )}

                  {hasPermission(props.domain, props.group.id, 'can_delete_group') && (
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        color='red'
                        icon={<IconTrash size={16} />}
                        onClick={() => {
                          openConfirmModal({
                            title: 'Delete Channel Group',
                            modalProps: {
                              yOffset: `${Math.max(30 - props.group.channels.length * 0.6, 1)}vh`,
                            },
                            content: (
                              <>
                                <p style={{ marginBlockEnd: 0 }}>Are you sure you want to delete <b>{props.group.name}</b> and the following channels?</p>
                                <ul style={{ marginBlockStart: 0, marginBlockEnd: 0 }}>
                                  {props.group.channels.map(channel_id => (
                                    <li key={channel_id}><b>{props.domain.channels[channel_id].name}</b></li>
                                  ))}
                                </ul>
                              </>
                            ),
                            confirmLabel: 'Delete',
                            typeToConfirm: props.group.channels.length > 2 ? props.group.name : undefined,
                            confirmText: (<>Please type <b>{props.group.name}</b> to confirm this action.</>),
                            onConfirm: () => {
                              props.domain._mutators.removeGroup(props.group.id);
                            }
                          })
                        }}
                      >
                        Delete group
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>

          {!snapshot.isDragging && opened && (
            <Droppable droppableId={props.group.id} type='channel' isDropDisabled={!(hasPermission(props.domain, props.group.id, 'can_manage') || hasPermission(props.domain, props.group.id, 'can_manage_resources'))}>
              {(provided) => (
                <Stack
                  ref={provided.innerRef}
                  mih='0.5rem'
                  spacing={0}
                  {...provided.droppableProps}
                >
                  {props.group.channels.map((channel_id, i) => (
                    <SingleChannel
                      key={channel_id}
                      channel={props.domain.channels[channel_id]}
                      domain={props.domain}
                      group_id={props.group.id}
                      selected={props.selected === channel_id}
                      onClick={() => {
                        if (props.domain._exists)
                          app._mutators.setChannel(channel_id);
                      }}
                      onDelete={() => {
                        const channels = Object.values(props.domain.channels);
                        if (channels.length > 0)
                          app._mutators.setChannel(channels[0].id);
                      }}

                      index={i}
                    />
                  ))}

                  {provided.placeholder}
                </Stack>
              )}
            </Droppable>
          )}
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
  return (
    <ScrollArea>
      <DragDropContext onDragEnd={(result) => {
        // Don't allow delete channel by drag
        if (!result.destination) return;
        if (result.destination.index === result.source.index && result.destination.droppableId === result.source.droppableId) return;

        // Move channel
        if (result.type === 'channel') {
          props.domain._mutators.moveChannel(result.draggableId, {
            group_id: result.source.droppableId,
            index: result.source.index,
          }, {
            group_id: result.destination.droppableId,
            index: result.destination.index,
          });
        }

        // Move group
        else if (result.type === 'group') {
          props.domain._mutators.moveGroup(result.source.index, result.destination.index);
        }
      }}>
        <Droppable droppableId={props.domain.id} type='group'>
          {(provided) => (
            <Stack
              ref={provided.innerRef}
              spacing={0}
              pt={8}
              {...provided.droppableProps}
            >
              {props.domain.groups.map((group, group_idx) => (
                <ChannelGroupComponent
                  key={group.id}
                  domain={props.domain}
                  group={group}
                  selected={props.channel_id}
                  index={group_idx}
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