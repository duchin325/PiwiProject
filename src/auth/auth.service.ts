import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

const fake_user = {
  username: 'admin',
  passwordHash: bcrypt.hashSync('clipper325', 10),
};

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async validateUser(username: string, password: string): Promise<any> {
    if (username !== fake_user.username) throw new UnauthorizedException();

    const match = await bcrypt.compare(password, fake_user.passwordHash);
    if (!match) throw new UnauthorizedException();
    return { username };
  }

  async login(user: any) {
    const payload = { username: user.username };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
