import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  capacity: integer('capacity').notNull(),
  imageUrl: text('image_url'),
  openTime: text('open_time').notNull().default('09:00'),
  closeTime: text('close_time').notNull().default('17:00'),
});

export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey(),
  roomId: integer('room_id').references(() => rooms.id).notNull(),
  userId: text('user_id'), // Clerk User ID (Optional for guest bookings or admin overrides)
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  organization: text('organization'),
  purpose: text('purpose').notNull(),
  needPccHelp: integer('need_pcc_help', { mode: 'boolean' }).default(false).notNull(),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  status: text('status').$type<'pending' | 'confirmed' | 'cancelled'>().default('confirmed'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON string for flexibility
});

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(), // Hashed password
  fullName: text('full_name'),
  email: text('email'),
  role: text('role').$type<'admin' | 'staff'>().default('admin').notNull(),
  officeHours: text('office_hours'), // JSON string for individual schedule
  bio: text('bio'), // "What you can ask me about"
});
