import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// MVP: hardcoded users. Replace with DB lookup when users table is implemented.
const USERS = [
  {
    username: 'admin@demo.com',
    passwordHash: bcrypt.hashSync('adm_123', 10),
    role: 'admin',
  },
];

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<{ username: string; role: string }> {
    const user = USERS.find((u) => u.username === username);
    if (!user) throw new UnauthorizedException();

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedException();
    return { username: user.username, role: user.role };
  }

  login(user: { username: string; role: string }) {
    const payload = { username: user.username, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
