import { openContextModal } from '@mantine/modals';

import CreateChannel, { CreateChannelProps } from './CreateChannel';
import { CreateTask, CreateTaskProps, EditTask, EditTaskProps } from './CreateTask';


////////////////////////////////////////////////////////////
export const modals = {
	'create-channel': CreateChannel,
	'create-task': CreateTask,
	'edit-task': EditTask,
};


/** Opens the modal to create channels */
export const openCreateChannel = (props: CreateChannelProps) => openContextModal({
	modal: 'create-channel',
	title: 'Create Channel',
	innerProps: props,
});


/** Opens the modal to create channels */
export const openCreateTask = (props: CreateTaskProps) => openContextModal({
	modal: 'create-task',
	title: 'Create Task',
	innerProps: props,
	size: 'xl',
});


/** Opens the modal to create channels */
export const openEditTask = (props: EditTaskProps) => openContextModal({
	modal: 'edit-task',
	title: `${props.board_prefix}-${props.task.sid}`,
	innerProps: props,
	size: '120ch',
});