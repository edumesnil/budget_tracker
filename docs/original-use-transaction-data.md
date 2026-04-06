# Original useTransactionData Hook Implementation

This is a backup of the original useTransactionData hook implementation before migrating to React Query.

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseBrowser } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export type Transaction = {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  category_id: string | null;
  category_name?: string;
  category_type?: "INCOME" | "EXPENSE";
  notes?: string | null;
  categories?: {
    icon?: string | null;
    color?: string | null;
  };
};

export type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  color?: string | null;
  icon?: string | null;
};

export type TransactionFormData = {
  description: string;
  amount: string;
  date: string;
  categoryId: string;
  notes: string;
};

export function useTransactionData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetchingCategories, setFetchingCategories] = useState(false);

  // Month filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  // Month names for the dropdown
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Fetch transactions
  const fetchTransactions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseBrowser();

      // Fetch transactions with category information
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          date,
          description,
          amount,
          category_id,
          notes,
          categories:category_id (
            name,
            type,
            icon,
            color
          )
        `,
        )
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) {
        throw error;
      }

      // Transform the data to include category name and type
      const formattedTransactions = data.map((transaction: any) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        category_id: transaction.category_id,
        category_name: transaction.categories?.name || "Uncategorized",
        category_type: transaction.categories?.type || null,
        notes: transaction.notes,
        categories: {
          icon: transaction.categories?.icon || null,
          color: transaction.categories?.color || null,
        },
      }));

      setTransactions(formattedTransactions);
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  // Handle month navigation
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    if (!user) return;

    try {
      setFetchingCategories(true);
      const supabase = getSupabaseBrowser();

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, type, color, icon")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;

      setCategories(data || []);
    } catch (err: any) {
      console.error("Error fetching categories:", err);
    } finally {
      setFetchingCategories(false);
    }
  };

  // Delete transaction
  const deleteTransaction = async (transactionId: string) => {
    if (!user) return;

    try {
      setError(null);

      const supabase = getSupabaseBrowser();

      // Delete the transaction
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      // Update the local state to remove the deleted transaction
      setTransactions((prevTransactions) => prevTransactions.filter((t) => t.id !== transactionId));

      // Show success message
      toast({
        title: "Success",
        description: "Transaction deleted successfully!",
        variant: "success",
        duration: 4000,
      });

      return true;
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      setError(`Failed to delete transaction: ${err.message}`);
      return false;
    }
  };

  // Add/Edit transaction
  const saveTransaction = async (formData: TransactionFormData, transactionId?: string) => {
    if (!user) return false;

    try {
      setError(null);

      // Validate inputs
      if (!formData.description) {
        setError("Please enter a description");
        return false;
      }

      if (!formData.amount || isNaN(Number.parseFloat(formData.amount))) {
        setError("Please enter a valid amount");
        return false;
      }

      if (!formData.date) {
        setError("Please select a date");
        return false;
      }

      if (!formData.categoryId) {
        setError("Please select a category");
        return false;
      }

      const supabase = getSupabaseBrowser();

      // Get the category to determine if it's income or expense
      let adjustedAmount = Number.parseFloat(formData.amount);
      const selectedCategory = categories.find((cat) => cat.id === formData.categoryId);

      // Adjust amount sign based on category type
      if (selectedCategory?.type === "EXPENSE") {
        adjustedAmount = Math.abs(adjustedAmount) * -1;
      } else if (selectedCategory?.type === "INCOME") {
        adjustedAmount = Math.abs(adjustedAmount);
      }

      // Prepare the transaction data
      const transactionData = {
        description: formData.description,
        amount: adjustedAmount,
        date: formData.date,
        category_id: formData.categoryId,
        notes: formData.notes || null,
      };

      if (transactionId) {
        // Update existing transaction
        const { data: updatedTransaction, error: updateError } = await supabase
          .from("transactions")
          .update(transactionData)
          .eq("id", transactionId)
          .eq("user_id", user.id).select(`
          id,
          date,
          description,
          amount,
          category_id,
          notes,
          categories:category_id (
            name,
            type,
            icon,
            color
          )
        `);

        if (updateError) throw updateError;

        // Update the transaction in the local state
        if (updatedTransaction && updatedTransaction.length > 0) {
          const formattedTransaction = {
            id: updatedTransaction[0].id,
            date: updatedTransaction[0].date,
            description: updatedTransaction[0].description,
            amount: updatedTransaction[0].amount,
            category_id: updatedTransaction[0].category_id,
            category_name: updatedTransaction[0].categories?.name || "Uncategorized",
            category_type: updatedTransaction[0].categories?.type || null,
            notes: updatedTransaction[0].notes,
            categories: {
              icon: updatedTransaction[0].categories?.icon || null,
              color: updatedTransaction[0].categories?.color || null,
            },
          };

          setTransactions((prevTransactions) =>
            prevTransactions.map((t) => (t.id === transactionId ? formattedTransaction : t)),
          );
        }

        toast({
          title: "Success",
          description: "Transaction updated successfully!",
          variant: "success",
          duration: 4000,
        });
      } else {
        // Insert new transaction
        const { data: newTransaction, error: insertError } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            ...transactionData,
          }).select(`
          id,
          date,
          description,
          amount,
          category_id,
          notes,
          categories:category_id (
            name,
            type,
            icon,
            color
          )
        `);

        if (insertError) throw insertError;

        // Add the new transaction to the local state
        if (newTransaction && newTransaction.length > 0) {
          const formattedTransaction = {
            id: newTransaction[0].id,
            date: newTransaction[0].date,
            description: newTransaction[0].description,
            amount: newTransaction[0].amount,
            category_id: newTransaction[0].category_id,
            category_name: newTransaction[0].categories?.name || "Uncategorized",
            category_type: newTransaction[0].categories?.type || null,
            notes: newTransaction[0].notes,
            categories: {
              icon: newTransaction[0].categories?.icon || null,
              color: newTransaction[0].categories?.color || null,
            },
          };

          setTransactions((prevTransactions) => [formattedTransaction, ...prevTransactions]);
        }

        toast({
          title: "Success",
          description: "Transaction created successfully!",
          variant: "success",
          duration: 4000,
        });
      }

      return true;
    } catch (err: any) {
      console.error("Error with transaction:", err);
      setError(`Failed to ${transactionId ? "update" : "create"} transaction: ${err.message}`);
      return false;
    }
  };

  // Filter transactions by selected month and year
  useEffect(() => {
    if (transactions.length > 0) {
      const filtered = transactions.filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        return (
          transactionDate.getMonth() === selectedMonth &&
          transactionDate.getFullYear() === selectedYear
        );
      });
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions([]);
    }
  }, [transactions, selectedMonth, selectedYear]);

  // Fetch transactions when user changes
  useEffect(() => {
    fetchTransactions();
  }, [user]);

  return {
    transactions,
    filteredTransactions,
    loading,
    error,
    setError,
    categories,
    fetchingCategories,
    fetchCategories,
    selectedMonth,
    selectedYear,
    monthNames,
    goToPreviousMonth,
    goToNextMonth,
    deleteTransaction,
    saveTransaction,
  };
}
```
