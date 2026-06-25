import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService){

        const secret = configService.get<string>('JWT_SECRET');
         if (!secret) {
            throw new Error('JWT_SECRET no está definido en el .env');
        }
        const options: StrategyOptions = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        };

        super(options);
    }
  
    async validate(payload: any) {
        return { username: payload.username }
    }
}
