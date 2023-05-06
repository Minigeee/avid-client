import { openContextModal } from '@mantine/modals';

import CreateChannel, { CreateChannelProps } from './CreateChannel';
import { CreateTask, CreateTaskProps, EditTask, EditTaskProps } from './CreateTask';
import {
	CreateTaskCollection, CreateTaskCollectionProps,
	EditTaskCollection, EditTaskCollectionProps
} from './CreateTaskCollection';


////////////////////////////////////////////////////////////
export const modals = {
	'create-channel': CreateChannel,
	'create-task': CreateTask,
	'edit-task': EditTask,
	'create-task-collection': CreateTaskCollection,
	'edit-task-collection': EditTaskCollection,
};


/** Opens the modal to create channels */
export const openCreateChannel = (props: CreateChannelProps) => openContextModal({
	modal: 'create-channel',
	title: 'New Channel',
	innerProps: props,
});


/** Opens the modal to create task */
export const openCreateTask = (props: CreateTaskProps) => openContextModal({
	modal: 'create-task',
	title: 'New Task',
	innerProps: props,
	size: 'xl',
});


/** Opens the modal to edit task */
export const openEditTask = (props: EditTaskProps) => openContextModal({
	modal: 'edit-task',
	title: `${props.board_prefix}-${props.task.sid}`,
	innerProps: props,
	size: '120ch',
});


/** Opens the modal to create task collection */
export const openCreateTaskCollection = (props: CreateTaskCollectionProps) => openContextModal({
	modal: 'create-task-collection',
	title: props.mode === 'cycle' ? 'New Cycle' : 'New Collection',
	innerProps: props,
	size: 'lg',
});


/** Opens the modal to edit task collection */
export const openEditTaskCollection = (props: EditTaskCollectionProps) => openContextModal({
	modal: 'edit-task-collection',
	title: `Edit ${props.collection.name}`,
	innerProps: props,
	size: 'lg',
});