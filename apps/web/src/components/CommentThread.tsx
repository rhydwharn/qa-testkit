"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Trash2, Edit2, X } from "lucide-react";

type EntityType = "TEST_CASE" | "TEST_CYCLE" | "TEST_PLAN";

interface Author {
  id: string;
  name: string | null;
  email: string | null;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: Author;
}

interface CommentThreadProps {
  entityType: EntityType;
  entityId: string;
}

export function CommentThread({ entityType, entityId }: CommentThreadProps) {
  if (!entityType || !entityId) return null;

  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const session = await response.json();
        if (session?.user?.id) {
          setCurrentUserId(session.user.id);
        }
      } catch (error) {
        console.error("Failed to fetch user session:", error);
      }
    };
    fetchUser();
  }, []);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/comments?entityType=${entityType}&entityId=${entityId}`
        );
        if (response.ok) {
          const data = await response.json();
          setComments(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComments();
  }, [entityType, entityId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: newComment,
          entityType,
          entityId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments([...comments, data]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingBody.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editingBody }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(
          comments.map((c) => (c.id === commentId ? data : c))
        );
        setEditingId(null);
        setEditingBody("");
      }
    } catch (error) {
      console.error("Failed to edit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  const isCommentAuthor = (authorId: string) => authorId === currentUserId;

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            No comments yet
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 border rounded-lg p-3 bg-card"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs bg-brand-100 text-brand-700">
                  {getInitials(comment.author.name || comment.author.email || "U")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      placeholder="Edit your comment..."
                      className="min-h-20"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEditComment(comment.id)}
                        disabled={isSubmitting}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditingBody("");
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {comment.author.name || comment.author.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {isCommentAuthor(comment.author.id) && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditingBody(comment.body);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-2 break-words">
                      {comment.body}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <div className="space-y-2 border-t pt-4">
        <label className="text-sm font-medium">Add a comment</label>
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Type your comment here..."
          className="min-h-20"
        />
        <Button
          onClick={handleAddComment}
          disabled={isSubmitting || !newComment.trim()}
        >
          Post Comment
        </Button>
      </div>
    </div>
  );
}

export default CommentThread;
