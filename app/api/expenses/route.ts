import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createExpenseEntry, postJournalEntry } from '@/lib/accounting';

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { expenseType, ...data } = body;
    const expense = await prisma.expense.create({
      data: {
        ...data,
        date: new Date(body.date),
      },
    });

    // Create and post journal entry
    const journalEntry = await createExpenseEntry(expense.id, expense.amount, expenseType || 'Operating');
    if (journalEntry) {
      await postJournalEntry(journalEntry.id);
    }

    return NextResponse.json(expense);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, expenseType, ...data } = body;
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...data,
        date: new Date(data.date),
      },
    });

    // Update journal entry: create new entry with the updated amount
    const journalEntry = await createExpenseEntry(expense.id, expense.amount, expenseType || 'Operating');
    if (journalEntry) {
      await postJournalEntry(journalEntry.id);
    }

    return NextResponse.json(expense);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Delete the expense
    await prisma.expense.delete({
      where: { id },
    });

    // Note: Journal entries should be reversed or deleted separately via accounting API
    // For now, the accounting module will handle orphaned entries

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
