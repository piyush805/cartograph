// Generated from the live schema by Supabase type generation. Regenerate after
// every migration rather than editing by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      analyses: {
        Row: {
          commit_sha: string | null;
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          organization_id: string;
          project_id: string;
          status: string;
        };
        Insert: {
          commit_sha?: string | null;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          organization_id: string;
          project_id: string;
          status?: string;
        };
        Update: {
          commit_sha?: string | null;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          organization_id?: string;
          project_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analyses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analyses_project_id_organization_id_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      edges: {
        Row: {
          analysis_id: string;
          id: number;
          kind: string;
          organization_id: string;
          source_file_id: number;
          target_file_id: number;
        };
        Insert: {
          analysis_id: string;
          id?: never;
          kind: string;
          organization_id: string;
          source_file_id: number;
          target_file_id: number;
        };
        Update: {
          analysis_id?: string;
          id?: never;
          kind?: string;
          organization_id?: string;
          source_file_id?: number;
          target_file_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "edges_analysis_id_organization_id_fkey";
            columns: ["analysis_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "edges_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edges_source_file_id_analysis_id_fkey";
            columns: ["source_file_id", "analysis_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id", "analysis_id"];
          },
          {
            foreignKeyName: "edges_target_file_id_analysis_id_fkey";
            columns: ["target_file_id", "analysis_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id", "analysis_id"];
          },
        ];
      };
      explanations: {
        Row: {
          analysis_id: string;
          body: string;
          content_hash: string;
          created_at: string;
          id: number;
          model: string;
          organization_id: string;
          subject_path: string;
        };
        Insert: {
          analysis_id: string;
          body: string;
          content_hash: string;
          created_at?: string;
          id?: never;
          model: string;
          organization_id: string;
          subject_path: string;
        };
        Update: {
          analysis_id?: string;
          body?: string;
          content_hash?: string;
          created_at?: string;
          id?: never;
          model?: string;
          organization_id?: string;
          subject_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "explanations_analysis_id_organization_id_fkey";
            columns: ["analysis_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "explanations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      file_roles: {
        Row: {
          analysis_id: string;
          file_id: number;
          id: number;
          organization_id: string;
          role: string;
          source: string;
        };
        Insert: {
          analysis_id: string;
          file_id: number;
          id?: never;
          organization_id: string;
          role: string;
          source: string;
        };
        Update: {
          analysis_id?: string;
          file_id?: number;
          id?: never;
          organization_id?: string;
          role?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "file_roles_analysis_id_organization_id_fkey";
            columns: ["analysis_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "file_roles_file_id_analysis_id_fkey";
            columns: ["file_id", "analysis_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id", "analysis_id"];
          },
          {
            foreignKeyName: "file_roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          analysis_id: string;
          content_hash: string;
          folder: string;
          id: number;
          lines: number;
          organization_id: string;
          path: string;
        };
        Insert: {
          analysis_id: string;
          content_hash: string;
          folder: string;
          id?: never;
          lines: number;
          organization_id: string;
          path: string;
        };
        Update: {
          analysis_id?: string;
          content_hash?: string;
          folder?: string;
          id?: never;
          lines?: number;
          organization_id?: string;
          path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_analysis_id_organization_id_fkey";
            columns: ["analysis_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      insights: {
        Row: {
          analysis_id: string;
          file_paths: string[];
          id: number;
          kind: string;
          organization_id: string;
        };
        Insert: {
          analysis_id: string;
          file_paths: string[];
          id?: never;
          kind: string;
          organization_id: string;
        };
        Update: {
          analysis_id?: string;
          file_paths?: string[];
          id?: never;
          kind?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "insights_analysis_id_organization_id_fkey";
            columns: ["analysis_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "insights_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          repo_name: string;
          repo_owner: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          repo_name: string;
          repo_owner: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          repo_name?: string;
          repo_owner?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      routes: {
        Row: {
          analysis_id: string;
          file_id: number;
          id: number;
          method: string;
          organization_id: string;
          path: string;
        };
        Insert: {
          analysis_id: string;
          file_id: number;
          id?: never;
          method: string;
          organization_id: string;
          path: string;
        };
        Update: {
          analysis_id?: string;
          file_id?: number;
          id?: never;
          method?: string;
          organization_id?: string;
          path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routes_analysis_id_organization_id_fkey";
            columns: ["analysis_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "routes_file_id_analysis_id_fkey";
            columns: ["file_id", "analysis_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id", "analysis_id"];
          },
          {
            foreignKeyName: "routes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
