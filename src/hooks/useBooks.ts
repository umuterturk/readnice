import { useState, useEffect, useRef } from 'react';
import { Book } from '../types';
import { useAuth } from './useAuth';
import { db } from '../firebase/firebase';
import { collection, doc, onSnapshot, setDoc, getDoc, query, getDocs, addDoc, deleteDoc } from 'firebase/firestore';

const STORAGE_KEY = 'book-reader-library';

export function useBooks() {
    const { user } = useAuth();
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const remoteUpdatingRef = useRef(false);

    // Load initial data: Firestore when signed in, otherwise localStorage
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const loadLocal = async () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    setBooks(JSON.parse(saved));
                    return;
                } catch (e) {
                    console.error('Failed to load books from localStorage', e);
                }
            }

            // First time use, add a sample book
            const module = await import('../../book');
            const sampleBook: Book = {
                id: 'sample-adventure',
                title: 'The Adventure of the Missing Letter',
                author: 'A. N. Storyteller',
                text: module.default,
                createdAt: Date.now(),
            };
            saveBooks([sampleBook]);
        };

        if (!user) {
            // signed out -> local storage
            loadLocal();
        } else {
            setLoading(true);
            setError(null);
            const booksCol = collection(db, 'users', user.uid, 'books');

            // Listen to per-book collection
            unsubscribe = onSnapshot(booksCol, (snap) => {
                remoteUpdatingRef.current = true;
                const docs: Book[] = [];
                snap.forEach((d) => {
                    const data = d.data() as any;
                    docs.push({
                        id: d.id,
                        title: data.title,
                        author: data.author,
                        text: data.text,
                        createdAt: data.createdAt,
                        bookmarks: data.bookmarks || [],
                    });
                });
                setBooks(docs.sort((a, b) => b.createdAt - a.createdAt));
                setLoading(false);
            }, (err) => {
                console.error('books collection snapshot error', err);
                setError(err as Error);
                setLoading(false);
            });

            // If no docs exist, seed from localStorage or sample
            (async () => {
                try {
                    const existing = await getDocs(booksCol);
                    if (existing.empty) {
                        const local = localStorage.getItem(STORAGE_KEY);
                        if (local) {
                            try {
                                const parsed = JSON.parse(local) as Book[];
                                for (const b of parsed) {
                                    const toSave = { ...b };
                                    const id = b.id || undefined;
                                    if (id) {
                                        await setDoc(doc(booksCol, id), toSave).catch(() => {});
                                    } else {
                                        await addDoc(booksCol, toSave).catch(() => {});
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to seed Firestore from localStorage', e);
                            }
                        } else {
                            const module = await import('../../book');
                            const sampleBook: Book = {
                                id: 'sample-adventure',
                                title: 'The Adventure of the Missing Letter',
                                author: 'A. N. Storyteller',
                                text: module.default,
                                createdAt: Date.now(),
                            };
                            await setDoc(doc(booksCol, sampleBook.id), sampleBook).catch(() => {});
                        }
                    }
                } catch (e) {
                    console.error('Error ensuring books collection', e);
                }
            })();
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user]);

    const saveBooks = async (newBooks: Book[]) => {
        setBooks(newBooks);

        if (user) {
            if (remoteUpdatingRef.current) {
                remoteUpdatingRef.current = false;
                return;
            }
            try {
                // Sync per-book docs: overwrite existing set by writing each book doc and deleting removed ones
                const booksCol = collection(db, 'users', user.uid, 'books');
                const remoteSnapshot = await getDocs(booksCol);
                const remoteIds = new Set<string>();
                remoteSnapshot.forEach(d => remoteIds.add(d.id));

                // Write/update local books
                for (const b of newBooks) {
                    const id = b.id;
                    await setDoc(doc(booksCol, id), b);
                    remoteIds.delete(id);
                }

                // Delete any remote docs not present locally
                for (const id of remoteIds) {
                    await deleteDoc(doc(booksCol, id));
                }
            } catch (e) {
                console.error('Failed to save books to Firestore', e);
                setError(e as Error);
            }
        } else {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newBooks));
            } catch (e) {
                console.error('Failed to save books to localStorage', e);
            }
        }
    };

    const addBook = (book: Omit<Book, 'id' | 'createdAt'>) => {
        const newBook: Book = {
            ...book,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        saveBooks([newBook, ...books]);
        return newBook;
    };

    const removeBook = (id: string) => {
        saveBooks(books.filter((b: Book) => b.id !== id));
    };

    const updateBook = (id: string, updates: Partial<Book>) => {
        saveBooks(books.map((b: Book) => (b.id === id ? { ...b, ...updates } : b)));
    };

    const addBookmark = (bookId: string, position: number, label: string) => {
        const book = books.find((b: Book) => b.id === bookId);
        if (!book) return;
        const newBookmark = {
            id: crypto.randomUUID(),
            position,
            label,
            createdAt: Date.now(),
        };
        const updatedBookmarks = [...(book.bookmarks || []), newBookmark];
        updateBook(bookId, { bookmarks: updatedBookmarks });
    };

    const removeBookmark = (bookId: string, bookmarkId: string) => {
        const book = books.find((b: Book) => b.id === bookId);
        if (!book || !book.bookmarks) return;
        const updatedBookmarks = book.bookmarks.filter((b) => b.id !== bookmarkId);
        updateBook(bookId, { bookmarks: updatedBookmarks });
    };

    const updateBookmark = (bookId: string, bookmarkId: string, newLabel: string) => {
        const book = books.find((b: Book) => b.id === bookId);
        if (!book || !book.bookmarks) return;
        const updatedBookmarks = book.bookmarks.map((b) =>
            b.id === bookmarkId ? { ...b, label: newLabel } : b
        );
        updateBook(bookId, { bookmarks: updatedBookmarks });
    };

    return { books, loading, error, addBook, removeBook, updateBook, addBookmark, removeBookmark, updateBookmark };
}

