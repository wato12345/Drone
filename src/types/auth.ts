export interface AuthUser {
  id: string
  username: string
  email: string | null
  createdAt: string
}

export interface AuthResponse {
  user: AuthUser
}
